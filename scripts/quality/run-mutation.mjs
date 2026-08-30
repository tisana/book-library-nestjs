import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { arch, platform as osPlatform, release } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import crossSpawn from 'cross-spawn';

import {
  evaluateMutationReport,
  formatPolicySummary,
} from './mutation-policy.mjs';

const SELECTED_SOURCES = [
  'src/auth/token-session.service.ts',
  'src/auth/auth-identifier-repair.service.ts',
  'src/auth/auth-identifier-reconciliation.service.ts',
  'src/members/members.service.ts',
  'src/borrowings/borrowings.service.ts',
];
const SMOKE_SHARDS = [
  {
    id: 'token-session',
    source: SELECTED_SOURCES[0],
    concurrency: 2,
  },
  {
    id: 'identifier-repair',
    source: SELECTED_SOURCES[1],
    concurrency: 2,
  },
  {
    id: 'identifier-reconciliation',
    source: SELECTED_SOURCES[2],
    concurrency: 2,
  },
  {
    id: 'members',
    source: SELECTED_SOURCES[3],
    concurrency: 4,
  },
  {
    id: 'borrowings',
    source: SELECTED_SOURCES[4],
    concurrency: 2,
  },
];
const COMPLETE_SHARDS = SMOKE_SHARDS.map(({ id, source }) => ({
  id,
  source,
  concurrency: 4,
}));
const SMOKE_MUTANT_COUNT = 1366;
const COMPLETE_MUTANT_COUNT = 1727;
const BUDGETS = { smoke: 350000, complete: 900000 };
const CLEANUP_GRACE_MS = 10000;
const FORCE_CLEANUP_VERIFY_MS = 10000;
const PROCESS_TREE_POLL_MS = 25;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const AGGREGATE_ARTIFACTS = [
  'mutation.json',
  'mutation.html',
  'duration.json',
  'summary.json',
  'summary.md',
];

function requireProfile(profile) {
  if (profile !== 'smoke' && profile !== 'complete') {
    throw new TypeError('Profile must be exactly smoke or complete.');
  }
  return profile;
}

function repositoryPath(root, trackedPath) {
  return join(root, ...trackedPath.split('/'));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function defaultCommitSha(root) {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
}

function isoTimestamp(value, label) {
  const timestamp = value instanceof Date ? value.toISOString() : String(value);
  if (
    !ISO_UTC_PATTERN.test(timestamp) ||
    !Number.isFinite(Date.parse(timestamp))
  ) {
    throw new TypeError(`${label} must be an ISO-8601 UTC timestamp.`);
  }
  return timestamp;
}

function validateDuration(duration) {
  if (!BUDGETS[duration.profile]) {
    throw new TypeError('Duration profile is invalid.');
  }
  isoTimestamp(duration.startedAt, 'duration.startedAt');
  isoTimestamp(duration.finishedAt, 'duration.finishedAt');
  if (!Number.isFinite(duration.durationMs) || duration.durationMs < 0) {
    throw new TypeError('duration.durationMs must be non-negative.');
  }
  if (duration.budgetMs !== BUDGETS[duration.profile]) {
    throw new TypeError('Duration profile and budget disagree.');
  }
  if (typeof duration.timedOut !== 'boolean') {
    throw new TypeError('duration.timedOut must be boolean.');
  }
  if (
    duration.strykerExitCode !== null &&
    !Number.isInteger(duration.strykerExitCode)
  ) {
    throw new TypeError('duration.strykerExitCode must be an integer or null.');
  }
  if (!Number.isInteger(duration.policyExitCode)) {
    throw new TypeError('duration.policyExitCode must be an integer.');
  }
  if (!COMMIT_PATTERN.test(duration.commitSha)) {
    throw new TypeError(
      'duration.commitSha must be 40 lowercase hexadecimal characters.',
    );
  }
  for (const field of ['nodeVersion', 'os']) {
    if (typeof duration[field] !== 'string' || duration[field].trim() === '') {
      throw new TypeError(`duration.${field} must be non-empty.`);
    }
  }
  return duration;
}

function sourceHashes(manifest) {
  const hashes = {};
  for (const source of SELECTED_SOURCES) {
    const rule = manifest.rules.find((entry) => entry.source === source);
    if (!rule || !/^[0-9a-f]{64}$/.test(rule.sourceSha256)) {
      throw new TypeError(`Manifest source hash is missing for ${source}.`);
    }
    hashes[source] = rule.sourceSha256;
  }
  return hashes;
}

function configurationSha256(root) {
  return createHash('sha256')
    .update(readFileSync(repositoryPath(root, 'stryker.config.mjs')))
    .digest('hex');
}

function nodeMajor(version) {
  const match = /^v(\d+)\./.exec(version);
  if (!match) {
    throw new TypeError(`Node version is invalid: ${version}.`);
  }
  return Number(match[1]);
}

export function launchLocalNpx(args, options) {
  if (!Array.isArray(args) || options?.shell !== false) {
    throw new TypeError(
      'Local npx launch requires an argument array and shell:false.',
    );
  }
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  return crossSpawn(command, args, options);
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') {
      return false;
    }
    throw error;
  }
}

function windowsProcessRows() {
  const output = execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "$ErrorActionPreference='Stop'; @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId) | ConvertTo-Json -Compress",
    ],
    { encoding: 'utf8', windowsHide: true },
  ).trim();
  if (output === '') {
    return [];
  }
  const rows = JSON.parse(output);
  return (Array.isArray(rows) ? rows : [rows]).map((row) => ({
    pid: Number(row.ProcessId),
    parentPid: Number(row.ParentProcessId),
  }));
}

function descendantPids(rootPid, rows) {
  const childrenByParent = new Map();
  for (const row of rows) {
    const children = childrenByParent.get(row.parentPid) ?? [];
    children.push(row.pid);
    childrenByParent.set(row.parentPid, children);
  }
  const descendants = [];
  const pending = [...(childrenByParent.get(rootPid) ?? [])];
  while (pending.length > 0) {
    const pid = pending.shift();
    descendants.push(pid);
    pending.push(...(childrenByParent.get(pid) ?? []));
  }
  return descendants;
}

function createProcessTree(child, platform) {
  const rootPid = Number(child.pid);
  return {
    child,
    childClosed: false,
    platform,
    rootPid: Number.isInteger(rootPid) && rootPid > 0 ? rootPid : null,
    trackedPids: new Set(
      Number.isInteger(rootPid) && rootPid > 0 ? [rootPid] : [],
    ),
  };
}

function refreshWindowsTree(tree) {
  if (tree.rootPid === null || !processIsAlive(tree.rootPid)) {
    return;
  }
  for (const pid of descendantPids(tree.rootPid, windowsProcessRows())) {
    tree.trackedPids.add(pid);
  }
}

function runTaskkill(pid, force) {
  try {
    execFileSync(
      'taskkill.exe',
      ['/PID', String(pid), '/T', ...(force ? ['/F'] : [])],
      { stdio: 'ignore', windowsHide: true },
    );
  } catch (error) {
    if (force && processIsAlive(pid)) {
      throw error;
    }
  }
}

function terminateProcessTree(tree, signal) {
  if (tree.rootPid === null) {
    tree.child.kill(signal);
    return;
  }
  if (tree.platform === 'win32') {
    refreshWindowsTree(tree);
    const force = signal === 'SIGKILL';
    if (processIsAlive(tree.rootPid)) {
      runTaskkill(tree.rootPid, force);
    }
    if (force) {
      for (const pid of [...tree.trackedPids].reverse()) {
        if (processIsAlive(pid)) {
          runTaskkill(pid, true);
        }
      }
    }
    return;
  }
  try {
    process.kill(-tree.rootPid, signal);
  } catch (error) {
    if (error?.code !== 'ESRCH') {
      throw error;
    }
  }
}

function processTreeIsAlive(tree) {
  if (tree.rootPid === null) {
    return !tree.childClosed;
  }
  if (tree.platform === 'win32') {
    refreshWindowsTree(tree);
    return [...tree.trackedPids].some(processIsAlive);
  }
  try {
    process.kill(-tree.rootPid, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') {
      return false;
    }
    throw error;
  }
}

function waitForProcessTreeExit(tree, timeoutMs, dependencies) {
  return new Promise((resolvePromise, reject) => {
    let deadlineTimer;
    let pollTimer;
    let settled = false;
    const clear = () => {
      if (deadlineTimer !== undefined) {
        dependencies.cancelTimeout(deadlineTimer);
      }
      if (pollTimer !== undefined) {
        dependencies.cancelPoll(pollTimer);
      }
    };
    const finish = (value) => {
      if (!settled) {
        settled = true;
        clear();
        resolvePromise(value);
      }
    };
    const fail = (error) => {
      if (!settled) {
        settled = true;
        clear();
        reject(error);
      }
    };
    const poll = () => {
      try {
        if (!processTreeIsAlive(tree)) {
          finish(true);
          return;
        }
        pollTimer = dependencies.schedulePoll(poll, PROCESS_TREE_POLL_MS);
      } catch (error) {
        fail(error);
      }
    };
    deadlineTimer = dependencies.scheduleTimeout(
      () => finish(false),
      timeoutMs,
    );
    poll();
  });
}

async function cleanupTimedOutProcessTree(tree, dependencies) {
  terminateProcessTree(tree, 'SIGTERM');
  if (await waitForProcessTreeExit(tree, CLEANUP_GRACE_MS, dependencies)) {
    return;
  }
  terminateProcessTree(tree, 'SIGKILL');
  if (
    !(await waitForProcessTreeExit(tree, FORCE_CLEANUP_VERIFY_MS, dependencies))
  ) {
    throw new Error(
      `Timed out verifying cleanup of process tree ${tree.rootPid}.`,
    );
  }
}

function reportDirectory(root, profile, shardId) {
  const tracked =
    shardId === undefined
      ? `reports/mutation/${profile}`
      : `reports/mutation/${profile}/shards/${shardId}`;
  return repositoryPath(root, tracked);
}

function nextHistoryDirectory(historyRoot) {
  mkdirSync(historyRoot, { recursive: true });
  let index = 1;
  while (true) {
    const candidate = join(
      historyRoot,
      `run-${String(index).padStart(4, '0')}`,
    );
    if (!existsSync(candidate)) {
      return candidate;
    }
    index += 1;
  }
}

function preserveShardDirectory(root, profile, shardId) {
  const directory = reportDirectory(root, profile, shardId);
  if (!existsSync(directory)) {
    return null;
  }
  const historyRoot = join(
    reportDirectory(root, profile),
    'history',
    'shards',
    shardId,
  );
  const historyDirectory = nextHistoryDirectory(historyRoot);
  renameSync(directory, historyDirectory);
  return historyDirectory;
}

function preserveAggregateArtifacts(root, profile) {
  const directory = reportDirectory(root, profile);
  const existing = AGGREGATE_ARTIFACTS.filter((name) =>
    existsSync(join(directory, name)),
  );
  if (existing.length === 0) {
    return null;
  }
  const historyDirectory = nextHistoryDirectory(
    join(directory, 'history', 'aggregate'),
  );
  mkdirSync(historyDirectory, { recursive: true });
  for (const name of existing) {
    renameSync(join(directory, name), join(historyDirectory, name));
  }
  return historyDirectory;
}

function launchStryker(profile, shard, dependencies, timing) {
  const directory = reportDirectory(
    dependencies.repositoryRoot,
    profile,
    shard?.id,
  );
  if (shard) {
    preserveShardDirectory(dependencies.repositoryRoot, profile, shard.id);
  }
  mkdirSync(directory, { recursive: true });
  const command = dependencies.platform === 'win32' ? 'npx.cmd' : 'npx';
  const environment = {
    ...dependencies.environment,
    MUTATION_PROFILE: profile,
  };
  if (shard) {
    environment.MUTATION_SHARD = shard.id;
  } else {
    delete environment.MUTATION_SHARD;
  }
  const logPath = join(directory, 'stryker.log');
  let logFd;
  let child;
  try {
    const stdio = shard
      ? (() => {
          logFd = openSync(logPath, 'w');
          return ['ignore', logFd, logFd];
        })()
      : 'inherit';
    child = dependencies.spawnProcess(
      command,
      ['--no-install', 'stryker', 'run'],
      {
        cwd: dependencies.repositoryRoot,
        env: environment,
        shell: false,
        stdio,
        detached: dependencies.platform !== 'win32',
        windowsHide: true,
        mutationLogPath: logPath,
      },
    );
  } finally {
    if (logFd !== undefined) {
      closeSync(logFd);
    }
  }
  const tree = createProcessTree(child, dependencies.platform);
  const handle = {
    child,
    directory,
    error: null,
    exitCode: null,
    settled: false,
    shard,
    signal: null,
    startedAt: timing?.startedAt ?? null,
    startedPerformance: timing?.startedPerformance ?? null,
    finishedAt: null,
    durationMs: null,
    tree,
  };
  handle.observation = new Promise((resolvePromise) => {
    const finish = (exitCode, signal, error) => {
      if (handle.settled) {
        return;
      }
      handle.settled = true;
      handle.exitCode = exitCode;
      handle.signal = signal;
      handle.error = error;
      if (timing) {
        handle.finishedAt = isoTimestamp(
          dependencies.now(),
          `${shard.id}.finishedAt`,
        );
        handle.durationMs = Math.max(
          0,
          dependencies.performanceNow() - timing.startedPerformance,
        );
      }
      resolvePromise(handle);
    };
    child.once('error', (error) => finish(null, null, error));
    child.once('close', (code, signal) => {
      tree.childClosed = true;
      finish(code, signal, null);
    });
  });
  return handle;
}

function startSharedDeadline(handles, budgetMs, dependencies) {
  let timedOut = false;
  let unfinished = new Set();
  let cleanupPromise = Promise.resolve();
  let timer;
  const timeoutPromise = new Promise((resolvePromise) => {
    timer = dependencies.scheduleTimeout(() => {
      timedOut = true;
      unfinished = new Set(
        handles.filter((handle) => !handle.settled).map((handle) => handle),
      );
      cleanupPromise = Promise.all(
        [...unfinished].map((handle) =>
          cleanupTimedOutProcessTree(handle.tree, dependencies).catch(
            (error) => {
              handle.error = error;
            },
          ),
        ),
      );
      void cleanupPromise.then(resolvePromise);
    }, budgetMs);
  });
  return {
    cancel() {
      dependencies.cancelTimeout(timer);
    },
    get cleanupPromise() {
      return cleanupPromise;
    },
    get timedOut() {
      return timedOut;
    },
    get unfinished() {
      return unfinished;
    },
    timeoutPromise,
  };
}

function canonicalMutantIdentity(source, mutant) {
  if (mutant === null || typeof mutant !== 'object' || Array.isArray(mutant)) {
    throw new TypeError(`Canonical mutant for ${source} must be an object.`);
  }
  if (typeof mutant.mutatorName !== 'string' || mutant.mutatorName === '') {
    throw new TypeError(
      `Canonical mutant mutatorName is missing for ${source}.`,
    );
  }
  if (typeof mutant.replacement !== 'string') {
    throw new TypeError(
      `Canonical mutant replacement is missing for ${source}.`,
    );
  }
  const positions = [mutant.location?.start, mutant.location?.end];
  for (const position of positions) {
    if (
      !Number.isInteger(position?.line) ||
      position.line < 1 ||
      !Number.isInteger(position?.column) ||
      position.column < 0
    ) {
      throw new TypeError(
        `Canonical mutant location is invalid for ${source}.`,
      );
    }
  }
  return JSON.stringify([
    source,
    mutant.mutatorName,
    mutant.replacement,
    mutant.location.start.line,
    mutant.location.start.column,
    mutant.location.end.line,
    mutant.location.end.column,
  ]);
}

function validateShardDefinitions(profile, shards, manifest) {
  const expectedShards = profile === 'smoke' ? SMOKE_SHARDS : COMPLETE_SHARDS;
  if (!Array.isArray(shards) || shards.length !== expectedShards.length) {
    throw new TypeError(`${profile} topology requires exactly five shards.`);
  }
  const ids = new Set(shards.map((shard) => shard.id));
  const sources = new Set(shards.map((shard) => shard.source));
  if (ids.size !== shards.length) {
    throw new TypeError(`${profile} shard ids must be unique.`);
  }
  for (const expected of expectedShards) {
    const actual = shards.find((shard) => shard.id === expected.id);
    if (
      !actual ||
      actual.source !== expected.source ||
      actual.concurrency !== expected.concurrency
    ) {
      throw new TypeError(
        `${profile} shard topology is invalid for ${expected.id}.`,
      );
    }
  }
  if (
    SELECTED_SOURCES.some((source) => !sources.has(source)) ||
    sources.size !== SELECTED_SOURCES.length
  ) {
    throw new TypeError(
      `${profile} shard source union must equal selected sources.`,
    );
  }
  for (const [index, rule] of manifest.rules.entries()) {
    const owners = shards.filter((shard) => shard.source === rule.source);
    if (owners.length !== 1) {
      throw new TypeError(
        `Manifest rule ${index} must have exactly one whole-source shard owner.`,
      );
    }
  }
}

function htmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function mergeShardReports({
  profile,
  repositoryRoot,
  manifest,
  shards,
  shardResults,
  expectedMutantCount,
}) {
  validateShardDefinitions(profile, shards, manifest);
  const resultById = new Map(
    (shardResults ?? []).map((result) => [result.shardId, result]),
  );
  const files = {};
  const identities = new Set();
  let canonicalMutantCount = 0;
  let shardMutantCount = 0;
  let schemaVersion;
  let thresholds;
  let provenance;
  const expectedSourceSha256 = sourceHashes(manifest);
  for (const shard of shards) {
    const directory = reportDirectory(repositoryRoot, profile, shard.id);
    const jsonPath = join(directory, 'mutation.json');
    const htmlPath = join(directory, 'mutation.html');
    const durationPath = join(directory, 'duration.json');
    const summaryPath = join(directory, 'summary.json');
    const logPath = join(directory, 'stryker.log');
    if (!existsSync(jsonPath)) {
      throw new Error(`Missing ${shard.id} mutation.json.`);
    }
    if (!existsSync(htmlPath)) {
      throw new Error(`Missing ${shard.id} mutation.html.`);
    }
    for (const [label, path] of [
      ['duration.json', durationPath],
      ['summary.json', summaryPath],
      ['stryker.log', logPath],
    ]) {
      if (!existsSync(path)) {
        throw new Error(`Missing ${shard.id} ${label}.`);
      }
    }
    const report = readJson(jsonPath);
    const duration = readJson(durationPath);
    const summary = readJson(summaryPath);
    const reportSources = Object.keys(report?.files ?? {});
    if (reportSources.length !== 1 || reportSources[0] !== shard.source) {
      throw new TypeError(
        `Shard source for ${shard.id} must be exactly ${shard.source}.`,
      );
    }
    if (schemaVersion === undefined) {
      schemaVersion = report.schemaVersion;
      thresholds = report.thresholds;
    } else if (
      report.schemaVersion !== schemaVersion ||
      JSON.stringify(report.thresholds) !== JSON.stringify(thresholds)
    ) {
      throw new TypeError('Shard report schema and thresholds must agree.');
    }
    if (
      duration.profile !== profile ||
      duration.shardId !== shard.id ||
      duration.source !== shard.source ||
      duration.budgetMs !== BUDGETS[profile] ||
      duration.timedOut !== false ||
      !Number.isFinite(duration.durationMs) ||
      duration.durationMs < 0 ||
      duration.durationMs > BUDGETS[profile]
    ) {
      throw new TypeError(`Shard duration is invalid for ${shard.id}.`);
    }
    const candidateProvenance = {
      commitSha: summary.commitSha,
      nodeMajor: nodeMajor(summary.nodeVersion),
      sourceSha256: summary.sourceSha256,
      configurationSha256: summary.configurationSha256,
      reportSchemaVersion: summary.reportSchemaVersion,
    };
    if (
      summary.profile !== profile ||
      summary.shardId !== shard.id ||
      summary.source !== shard.source ||
      summary.artifactExitCode !== 0 ||
      summary.timedOut !== false ||
      !COMMIT_PATTERN.test(candidateProvenance.commitSha) ||
      !/^[0-9a-f]{64}$/.test(candidateProvenance.configurationSha256) ||
      candidateProvenance.reportSchemaVersion !== report.schemaVersion ||
      JSON.stringify(candidateProvenance.sourceSha256) !==
        JSON.stringify(expectedSourceSha256) ||
      duration.commitSha !== summary.commitSha ||
      nodeMajor(duration.nodeVersion) !== candidateProvenance.nodeMajor
    ) {
      throw new TypeError(`Shard provenance is invalid for ${shard.id}.`);
    }
    if (provenance === undefined) {
      provenance = candidateProvenance;
    } else if (
      JSON.stringify(candidateProvenance) !== JSON.stringify(provenance)
    ) {
      throw new TypeError(`Shard provenance disagrees for ${shard.id}.`);
    }
    const file = report.files[shard.source];
    if (!Array.isArray(file?.mutants)) {
      throw new TypeError(`Shard mutants are invalid for ${shard.id}.`);
    }
    shardMutantCount += file.mutants.length;
    for (const mutant of file.mutants) {
      const identity = canonicalMutantIdentity(shard.source, mutant);
      if (identities.has(identity)) {
        throw new TypeError(
          `Duplicate canonical mutant identity in ${shard.id}.`,
        );
      }
      identities.add(identity);
      canonicalMutantCount += 1;
    }
    const existing = files[shard.source];
    if (existing) {
      const existingMetadata = { ...existing };
      const shardMetadata = { ...file };
      delete existingMetadata.mutants;
      delete shardMetadata.mutants;
      if (JSON.stringify(existingMetadata) !== JSON.stringify(shardMetadata)) {
        throw new TypeError(
          `Sibling shard file metadata disagrees for ${shard.source}.`,
        );
      }
      existing.mutants.push(...file.mutants);
    } else {
      files[shard.source] = { ...file, mutants: [...file.mutants] };
    }
  }
  if (
    canonicalMutantCount !== shardMutantCount ||
    Object.keys(files).length !== SELECTED_SOURCES.length
  ) {
    throw new TypeError('Canonical mutant union omitted a shard mutant.');
  }
  if (canonicalMutantCount !== expectedMutantCount) {
    throw new TypeError(
      `Canonical mutant union must contain exactly ${expectedMutantCount} mutants; received ${canonicalMutantCount}.`,
    );
  }
  const canonicalReport = { schemaVersion, thresholds, files };
  const outputDirectory = reportDirectory(repositoryRoot, profile);
  mkdirSync(outputDirectory, { recursive: true });
  writeJson(join(outputDirectory, 'mutation.json'), canonicalReport);
  const rows = shards
    .map((shard) => {
      const result = resultById.get(shard.id);
      const status = result?.timedOut
        ? 'timed out'
        : result?.strykerExitCode === 0
          ? 'completed (exit 0)'
          : `completed (exit ${result?.strykerExitCode ?? 'unknown'})`;
      return `<li><a href="shards/${htmlEscape(shard.id)}/mutation.html">${htmlEscape(shard.id)}</a> — ${htmlEscape(shard.source)} — ${htmlEscape(status)}</li>`;
    })
    .join('\n');
  writeFileSync(
    join(outputDirectory, 'mutation.html'),
    `<!doctype html>\n<meta charset="utf-8">\n<title>Selective mutation ${htmlEscape(profile)} aggregate index</title>\n<h1>Selective mutation ${htmlEscape(profile)} aggregate index</h1>\n<p>Index only: each link opens one isolated Stryker shard report.</p>\n<ul>\n${rows}\n</ul>\n`,
    'utf8',
  );
  return { canonicalMutantCount, provenance, report: canonicalReport };
}

export function mergeSmokeShardReports({
  repositoryRoot,
  manifest,
  shards = SMOKE_SHARDS,
  shardResults,
}) {
  return mergeShardReports({
    profile: 'smoke',
    repositoryRoot,
    manifest,
    shards,
    shardResults,
    expectedMutantCount: SMOKE_MUTANT_COUNT,
  });
}

export function mergeCompleteShardReports({
  repositoryRoot,
  manifest,
  shards = COMPLETE_SHARDS,
  shardResults,
}) {
  return mergeShardReports({
    profile: 'complete',
    repositoryRoot,
    manifest,
    shards,
    shardResults,
    expectedMutantCount: COMPLETE_MUTANT_COUNT,
  });
}

function policyInputs(root) {
  const manifest = readJson(
    repositoryPath(root, 'test/quality/critical-rule-manifest.json'),
  );
  const allowlist = readJson(
    repositoryPath(root, 'test/quality/mutation-equivalents.json'),
  );
  const baselinePath = repositoryPath(
    root,
    'test/quality/mutation-baseline.json',
  );
  const baseline = existsSync(baselinePath) ? readJson(baselinePath) : null;
  return { allowlist, baseline, manifest };
}

function evaluateReport(profile, reportPath, inputs) {
  return evaluateMutationReport({
    profile,
    report: readJson(reportPath),
    manifest: inputs.manifest,
    allowlist: inputs.allowlist,
    baseline: inputs.baseline,
  });
}

function summaryFromEvaluation({
  childFields,
  duration,
  evaluation,
  inputs,
  policyError,
  shards,
}) {
  return {
    profile: duration.profile,
    commitSha: duration.commitSha,
    nodeVersion: duration.nodeVersion,
    os: duration.os,
    sourceSha256: sourceHashes(inputs.manifest),
    durationMs: duration.durationMs,
    budgetMs: duration.budgetMs,
    timedOut: duration.timedOut,
    strykerExitCode: duration.strykerExitCode,
    policyExitCode: duration.policyExitCode,
    policyPassed: evaluation?.passed === true,
    rawCombinedScore: evaluation?.rawCombinedScore ?? null,
    moduleScores: evaluation?.moduleScores ?? [],
    criticalFindings: evaluation?.criticalFindings ?? [],
    violations: evaluation?.violations ?? [],
    policyError,
    ...childFields,
    ...(shards ? { shards } : {}),
  };
}

function writeSummary(directory, summary, evaluation) {
  writeJson(join(directory, 'summary.json'), summary);
  const policyMarkdown = evaluation
    ? formatPolicySummary(evaluation)
    : `Mutation policy: FAIL\nProfile: ${summary.profile}\nPolicy error: ${summary.policyError}\n`;
  const evidenceMarkdown =
    summary.nodeMajor === undefined
      ? `Commit: ${summary.commitSha}\nNode: ${summary.nodeVersion}\nOS: ${summary.os}\nDuration: ${summary.durationMs} ms / ${summary.budgetMs} ms`
      : `Commit: ${summary.commitSha}\nNode major: ${summary.nodeMajor}\nMaximum shard duration: ${summary.maxShardDurationMs} ms / ${summary.budgetMs} ms`;
  writeFileSync(
    join(directory, 'summary.md'),
    `# Selective mutation summary\n\n${evidenceMarkdown}\n\n${policyMarkdown}`,
    'utf8',
  );
}

async function runSmokeSequentialInternal(dependencies, inputs) {
  const profile = 'smoke';
  const budgetMs = BUDGETS.smoke;
  const directory = reportDirectory(dependencies.repositoryRoot, profile);
  preserveAggregateArtifacts(dependencies.repositoryRoot, profile);
  mkdirSync(directory, { recursive: true });
  const started = dependencies.performanceNow();
  const handles = [];
  for (const shard of SMOKE_SHARDS) {
    const shardStartedAt = isoTimestamp(
      dependencies.now(),
      `${shard.id}.startedAt`,
    );
    const shardStarted = dependencies.performanceNow();
    const handle = launchStryker(profile, shard, dependencies, {
      startedAt: shardStartedAt,
      startedPerformance: shardStarted,
    });
    const deadline = startSharedDeadline([handle], budgetMs, dependencies);
    await Promise.race([handle.observation, deadline.timeoutPromise]);
    if (deadline.timedOut) {
      await deadline.cleanupPromise;
    } else {
      deadline.cancel();
    }
    await handle.observation;
    handle.timedOut = deadline.unfinished.has(handle);
    handles.push(handle);
  }

  const shardResults = handles.map((handle) => {
    const timedOut = handle.timedOut;
    const artifactExitCode =
      !timedOut &&
      !handle.error &&
      existsSync(join(handle.directory, 'mutation.json')) &&
      existsSync(join(handle.directory, 'mutation.html'))
        ? 0
        : 1;
    const result = {
      shardId: handle.shard.id,
      source: handle.shard.source,
      startedAt: handle.startedAt,
      finishedAt: handle.finishedAt,
      durationMs: handle.durationMs,
      budgetMs,
      timedOut,
      strykerExitCode: handle.exitCode,
      artifactExitCode,
      processError: handle.error?.message ?? null,
      signal: handle.signal,
    };
    const shardDuration = validateDuration({
      profile,
      shardId: result.shardId,
      source: result.source,
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      durationMs: result.durationMs,
      budgetMs,
      timedOut,
      strykerExitCode: result.strykerExitCode,
      policyExitCode: artifactExitCode,
      commitSha: dependencies.commitSha,
      nodeVersion: dependencies.nodeVersion,
      os: dependencies.os,
      configurationSha256: configurationSha256(dependencies.repositoryRoot),
    });
    writeJson(join(handle.directory, 'duration.json'), shardDuration);
    const report = existsSync(join(handle.directory, 'mutation.json'))
      ? readJson(join(handle.directory, 'mutation.json'))
      : null;
    writeJson(join(handle.directory, 'summary.json'), {
      profile,
      shardId: result.shardId,
      source: result.source,
      commitSha: dependencies.commitSha,
      nodeVersion: dependencies.nodeVersion,
      os: dependencies.os,
      sourceSha256: sourceHashes(inputs.manifest),
      configurationSha256: configurationSha256(dependencies.repositoryRoot),
      reportSchemaVersion: report?.schemaVersion ?? null,
      artifactExitCode,
      timedOut,
      strykerExitCode: result.strykerExitCode,
      processError: result.processError,
      signal: result.signal,
    });
    return result;
  });

  let evaluation = null;
  let policyError = null;
  try {
    mergeSmokeShardReports({
      repositoryRoot: dependencies.repositoryRoot,
      manifest: inputs.manifest,
      shards: SMOKE_SHARDS,
      shardResults,
    });
    evaluation = evaluateReport(
      profile,
      join(directory, 'mutation.json'),
      inputs,
    );
  } catch (error) {
    policyError = error instanceof Error ? error.message : String(error);
  }
  const policyExitCode = evaluation?.passed === true && !policyError ? 0 : 1;
  const durationMs = Math.max(0, dependencies.performanceNow() - started);
  const finishedAt = isoTimestamp(dependencies.now(), 'finishedAt');
  const firstStartedAt = shardResults[0].startedAt;
  const duration = validateDuration({
    profile,
    startedAt: firstStartedAt,
    finishedAt,
    durationMs,
    budgetMs,
    timedOut: shardResults.some((result) => result.timedOut),
    strykerExitCode: null,
    policyExitCode,
    commitSha: dependencies.commitSha,
    nodeVersion: dependencies.nodeVersion,
    os: dependencies.os,
  });
  writeJson(join(directory, 'duration.json'), duration);
  const summary = summaryFromEvaluation({
    childFields: {
      processError:
        shardResults.find((result) => result.processError)?.processError ??
        null,
      signal: shardResults.find((result) => result.signal)?.signal ?? null,
    },
    duration,
    evaluation,
    inputs,
    policyError,
    shards: shardResults,
  });
  summary.referenceBudgetEvidence = false;
  summary.canonicalMutantCount = evaluation ? SMOKE_MUTANT_COUNT : null;
  writeSummary(directory, summary, evaluation);
  const shardFailed = shardResults.some(
    (result) =>
      result.timedOut ||
      result.artifactExitCode !== 0 ||
      result.durationMs > budgetMs,
  );
  return {
    ...summary,
    exitCode:
      !shardFailed && !duration.timedOut && policyExitCode === 0 ? 0 : 1,
  };
}

function createDependencies(injected = {}) {
  const repositoryRoot = resolve(injected.repositoryRoot ?? process.cwd());
  return {
    repositoryRoot,
    platform: injected.platform ?? process.platform,
    environment: injected.environment ?? process.env,
    commitSha: injected.commitSha ?? defaultCommitSha(repositoryRoot),
    nodeVersion: injected.nodeVersion ?? process.version,
    os: injected.os ?? `${osPlatform()} ${release()} ${arch()}`,
    now: injected.now ?? (() => new Date()),
    performanceNow: injected.performanceNow ?? (() => performance.now()),
    spawnProcess:
      injected.spawnProcess ??
      ((_command, args, options) => launchLocalNpx(args, options)),
    scheduleTimeout: injected.scheduleTimeout ?? setTimeout,
    cancelTimeout: injected.cancelTimeout ?? clearTimeout,
    schedulePoll: injected.schedulePoll ?? setTimeout,
    cancelPoll: injected.cancelPoll ?? clearTimeout,
  };
}

function requireShard(profile, shardId) {
  const shards = profile === 'smoke' ? SMOKE_SHARDS : COMPLETE_SHARDS;
  const shard = shards.find((entry) => entry.id === shardId);
  if (!shard) {
    throw new TypeError(
      `${profile} shard must be exactly one of ${shards.map((entry) => entry.id).join(', ')}.`,
    );
  }
  return shard;
}

async function runShard(profile, shardId, injected) {
  const shard = requireShard(profile, shardId);
  const dependencies = createDependencies(injected);
  const inputs = policyInputs(dependencies.repositoryRoot);
  const budgetMs = BUDGETS[profile];
  const startedAt = isoTimestamp(dependencies.now(), `${shard.id}.startedAt`);
  const startedPerformance = dependencies.performanceNow();
  const handle = launchStryker(profile, shard, dependencies, {
    startedAt,
    startedPerformance,
  });
  const deadline = startSharedDeadline([handle], budgetMs, dependencies);
  await Promise.race([handle.observation, deadline.timeoutPromise]);
  if (deadline.timedOut) {
    await deadline.cleanupPromise;
  } else {
    deadline.cancel();
  }
  await handle.observation;
  const timedOut = deadline.unfinished.has(handle);
  const artifactExitCode =
    !timedOut &&
    !handle.error &&
    existsSync(join(handle.directory, 'mutation.json')) &&
    existsSync(join(handle.directory, 'mutation.html'))
      ? 0
      : 1;
  const configHash = configurationSha256(dependencies.repositoryRoot);
  const result = {
    profile,
    shardId: shard.id,
    source: shard.source,
    startedAt,
    finishedAt: handle.finishedAt,
    durationMs: handle.durationMs,
    budgetMs,
    timedOut,
    strykerExitCode: handle.exitCode,
    artifactExitCode,
    policyExitCode: artifactExitCode,
    processError: handle.error?.message ?? null,
    signal: handle.signal,
    commitSha: dependencies.commitSha,
    nodeVersion: dependencies.nodeVersion,
    os: dependencies.os,
    sourceSha256: sourceHashes(inputs.manifest),
    configurationSha256: configHash,
  };
  const duration = validateDuration({
    ...result,
  });
  writeJson(join(handle.directory, 'duration.json'), duration);
  const report = existsSync(join(handle.directory, 'mutation.json'))
    ? readJson(join(handle.directory, 'mutation.json'))
    : null;
  const summary = {
    ...result,
    reportSchemaVersion: report?.schemaVersion ?? null,
  };
  writeJson(join(handle.directory, 'summary.json'), summary);
  return {
    ...summary,
    exitCode: artifactExitCode === 0 && !timedOut && !handle.error ? 0 : 1,
  };
}

export async function runSmokeShard(shardId, injected = {}) {
  return runShard('smoke', shardId, injected);
}

export async function runCompleteShard(shardId, injected = {}) {
  return runShard('complete', shardId, injected);
}

async function runMerge(profile, injected) {
  const dependencies = createDependencies(injected);
  const inputs = policyInputs(dependencies.repositoryRoot);
  const directory = reportDirectory(dependencies.repositoryRoot, profile);
  preserveAggregateArtifacts(dependencies.repositoryRoot, profile);
  const shards = profile === 'smoke' ? SMOKE_SHARDS : COMPLETE_SHARDS;
  const shardEvidence = shards.map((shard) => ({
    duration: readJson(
      join(
        reportDirectory(dependencies.repositoryRoot, profile, shard.id),
        'duration.json',
      ),
    ),
    summary: readJson(
      join(
        reportDirectory(dependencies.repositoryRoot, profile, shard.id),
        'summary.json',
      ),
    ),
  }));
  const merge =
    profile === 'smoke' ? mergeSmokeShardReports : mergeCompleteShardReports;
  const merged = merge({
    repositoryRoot: dependencies.repositoryRoot,
    manifest: inputs.manifest,
    shards,
    shardResults: shardEvidence.map(({ summary }) => summary),
  });
  const evaluation = evaluateReport(
    profile,
    join(directory, 'mutation.json'),
    inputs,
  );
  const policyExitCode = evaluation.passed ? 0 : 1;
  const summary = {
    profile,
    commitSha: merged.provenance.commitSha,
    nodeMajor: merged.provenance.nodeMajor,
    sourceSha256: merged.provenance.sourceSha256,
    configurationSha256: merged.provenance.configurationSha256,
    reportSchemaVersion: merged.provenance.reportSchemaVersion,
    canonicalMutantCount: merged.canonicalMutantCount,
    maxShardDurationMs: Math.max(
      ...shardEvidence.map(({ duration }) => duration.durationMs),
    ),
    budgetMs: BUDGETS[profile],
    timedOut: false,
    referenceBudgetEvidence: false,
    policyExitCode,
    policyPassed: evaluation.passed,
    rawCombinedScore: evaluation.rawCombinedScore,
    moduleScores: evaluation.moduleScores,
    criticalFindings: evaluation.criticalFindings,
    violations: evaluation.violations,
    policyError: null,
    shards: shardEvidence.map(({ duration, summary: shardSummary }) => ({
      shardId: shardSummary.shardId,
      source: shardSummary.source,
      durationMs: duration.durationMs,
      budgetMs: duration.budgetMs,
      timedOut: duration.timedOut,
      strykerExitCode: shardSummary.strykerExitCode,
      artifactExitCode: shardSummary.artifactExitCode,
    })),
  };
  writeSummary(directory, summary, evaluation);
  return { ...summary, exitCode: policyExitCode };
}

export async function runSmokeMerge(injected = {}) {
  return runMerge('smoke', injected);
}

export async function runCompleteMerge(injected = {}) {
  return runMerge('complete', injected);
}

export async function runSmokeSequential(injected = {}) {
  const dependencies = createDependencies(injected);
  const inputs = policyInputs(dependencies.repositoryRoot);
  return runSmokeSequentialInternal(dependencies, inputs);
}

export async function runMutation(profile, injected = {}) {
  const validatedProfile = requireProfile(profile);
  if (validatedProfile === 'complete') {
    return runCompleteMerge(injected);
  }
  const dependencies = createDependencies(injected);
  const inputs = policyInputs(dependencies.repositoryRoot);
  return runSmokeSequentialInternal(dependencies, inputs);
}

async function main() {
  const args = process.argv.slice(2);
  let result;
  if (args[0] === 'smoke-shard' && args.length === 2) {
    result = await runSmokeShard(args[1]);
  } else if (args[0] === 'smoke-merge' && args.length === 1) {
    result = await runSmokeMerge();
  } else if (args[0] === 'complete-shard' && args.length === 2) {
    result = await runCompleteShard(args[1]);
  } else if (
    (args[0] === 'complete-merge' || args[0] === 'complete') &&
    args.length === 1
  ) {
    result = await runCompleteMerge();
  } else if (
    (args[0] === 'smoke-sequential' || args[0] === 'smoke') &&
    args.length === 1
  ) {
    result = await runSmokeSequential();
  } else {
    throw new TypeError(
      'Usage: run-mutation.mjs smoke-shard <id>|smoke-merge|smoke-sequential|complete-shard <id>|complete-merge',
    );
  }
  process.exitCode = result.exitCode;
}

const isDirect =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Selective mutation runner error: ${message}\n`);
    process.exitCode = 1;
  });
}
