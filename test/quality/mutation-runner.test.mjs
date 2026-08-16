import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { after, before, test } from 'node:test';

const REPOSITORY_ROOT = process.cwd();
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
    mutantCount: 211,
  },
  {
    id: 'identifier-repair',
    source: SELECTED_SOURCES[1],
    concurrency: 2,
    mutantCount: 401,
  },
  {
    id: 'identifier-reconciliation',
    source: SELECTED_SOURCES[2],
    concurrency: 2,
    mutantCount: 415,
  },
  {
    id: 'members',
    source: SELECTED_SOURCES[3],
    concurrency: 4,
    mutantCount: 204,
  },
  {
    id: 'borrowings',
    source: SELECTED_SOURCES[4],
    concurrency: 2,
    mutantCount: 135,
  },
];
const WHOLE_SOURCE_SHARDS = SMOKE_SHARDS;
const COMPLETE_SHARDS = [
  {
    id: 'token-session',
    source: SELECTED_SOURCES[0],
    concurrency: 4,
    mutantCount: 300,
  },
  {
    id: 'identifier-repair',
    source: SELECTED_SOURCES[1],
    concurrency: 4,
    mutantCount: 400,
  },
  {
    id: 'identifier-reconciliation',
    source: SELECTED_SOURCES[2],
    concurrency: 4,
    mutantCount: 400,
  },
  {
    id: 'members',
    source: SELECTED_SOURCES[3],
    concurrency: 4,
    mutantCount: 300,
  },
  {
    id: 'borrowings',
    source: SELECTED_SOURCES[4],
    concurrency: 4,
    mutantCount: 327,
  },
];
const MANIFEST = JSON.parse(
  readFileSync(
    join(REPOSITORY_ROOT, 'test', 'quality', 'critical-rule-manifest.json'),
    'utf8',
  ),
);
const ORIGINAL_PROFILE = process.env.MUTATION_PROFILE;
const ORIGINAL_SHARD = process.env.MUTATION_SHARD;

process.env.MUTATION_PROFILE = 'smoke';
process.env.MUTATION_SHARD = WHOLE_SOURCE_SHARDS[0].id;
const { buildStrykerConfig, default: defaultConfig } =
  await import('../../stryker.config.mjs');
const runnerModule = await import('../../scripts/quality/run-mutation.mjs');
const { mergeCompleteShardReports, mergeSmokeShardReports, runMutation } =
  runnerModule;

let temporaryRoots;

before(() => {
  temporaryRoots = [];
});

after(() => {
  if (ORIGINAL_PROFILE === undefined) {
    delete process.env.MUTATION_PROFILE;
  } else {
    process.env.MUTATION_PROFILE = ORIGINAL_PROFILE;
  }
  if (ORIGINAL_SHARD === undefined) {
    delete process.env.MUTATION_SHARD;
  } else {
    process.env.MUTATION_SHARD = ORIGINAL_SHARD;
  }
  for (const root of temporaryRoots) {
    rmSync(root, { recursive: true, force: true });
  }
});

function temporaryRepository() {
  const root = mkdtempSync(join(tmpdir(), 'mutation-runner-'));
  temporaryRoots.push(root);
  for (const trackedPath of [
    ...SELECTED_SOURCES,
    'test/quality/critical-rule-manifest.json',
    'test/quality/mutation-equivalents.json',
    'stryker.config.mjs',
  ]) {
    const source = join(REPOSITORY_ROOT, ...trackedPath.split('/'));
    const target = join(root, ...trackedPath.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(source));
  }
  return root;
}

function makeReport(mutantsBySource = {}) {
  return {
    schemaVersion: '2.0',
    thresholds: { high: 80, low: 70 },
    files: Object.fromEntries(
      SELECTED_SOURCES.map((source) => [
        source,
        {
          language: 'typescript',
          source: readFileSync(
            join(REPOSITORY_ROOT, ...source.split('/')),
            'utf8',
          ),
          mutants: mutantsBySource[source] ?? [],
        },
      ]),
    ),
  };
}

function makeShardReport(source, mutants = []) {
  return {
    schemaVersion: '2.0',
    thresholds: { high: 80, low: 70 },
    files: {
      [source]: {
        language: 'typescript',
        source: readFileSync(
          join(REPOSITORY_ROOT, ...source.split('/')),
          'utf8',
        ),
        mutants,
      },
    },
  };
}

function canonicalMutant(source, overrides = {}) {
  const rule = MANIFEST.rules.find((entry) => entry.source === source);
  return {
    id: `mutant-${source}`,
    mutatorName: 'ConditionalExpression',
    replacement: 'false',
    status: 'Killed',
    location: {
      start: { line: rule.startLine, column: 1 },
      end: { line: rule.startLine, column: 2 },
    },
    ...overrides,
  };
}

function canonicalMutantsForWholeSource(shard) {
  const rule = MANIFEST.rules.find((entry) => entry.source === shard.source);
  return Array.from({ length: shard.mutantCount }, (_, index) =>
    canonicalMutant(shard.source, {
      id: `${shard.id}-${index}`,
      replacement: `${shard.id}-replacement-${index}`,
      location: {
        start: { line: rule.startLine, column: 1 },
        end: { line: rule.startLine, column: 2 },
      },
    }),
  );
}

function writeWholeSourceReport(root, shard) {
  writeShardArtifacts(
    root,
    shard,
    makeShardReport(shard.source, canonicalMutantsForWholeSource(shard)),
  );
}

function writeWholeSourceEvidence(
  root,
  shard,
  {
    commitSha = '0123456789abcdef0123456789abcdef01234567',
    configurationSha256 = 'a'.repeat(64),
    nodeVersion = 'v22.18.0',
    mutants = canonicalMutantsForWholeSource(shard),
  } = {},
) {
  writeShardArtifacts(root, shard, makeShardReport(shard.source, mutants));
  const directory = shardDirectory(root, shard.id);
  writeFileSync(join(directory, 'stryker.log'), '', 'utf8');
  const common = {
    profile: 'smoke',
    shardId: shard.id,
    source: shard.source,
    commitSha,
    nodeVersion,
    os: 'Linux 6.11 x64',
    sourceSha256: Object.fromEntries(
      SELECTED_SOURCES.map((source) => [
        source,
        MANIFEST.rules.find((rule) => rule.source === source).sourceSha256,
      ]),
    ),
    configurationSha256,
  };
  writeFileSync(
    join(directory, 'duration.json'),
    `${JSON.stringify({
      ...common,
      startedAt: '2026-08-12T10:00:00.000Z',
      finishedAt: '2026-08-12T10:01:00.000Z',
      durationMs: 60000,
      budgetMs: 350000,
      timedOut: false,
      strykerExitCode: 1,
      policyExitCode: 0,
    })}\n`,
  );
  writeFileSync(
    join(directory, 'summary.json'),
    `${JSON.stringify({
      ...common,
      reportSchemaVersion: '2.0',
      artifactExitCode: 0,
      timedOut: false,
      strykerExitCode: 1,
    })}\n`,
  );
}

function shardDirectory(root, shardId) {
  return join(root, 'reports', 'mutation', 'smoke', 'shards', shardId);
}

function completeShardDirectory(root, shardId) {
  return join(root, 'reports', 'mutation', 'complete', 'shards', shardId);
}

function writeCompleteShardArtifacts(
  root,
  shard,
  report,
  { html = true } = {},
) {
  const directory = completeShardDirectory(root, shard.id);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, 'mutation.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  if (html) {
    writeFileSync(
      join(directory, 'mutation.html'),
      `<!doctype html><title>complete ${shard.id}</title>\n`,
      'utf8',
    );
  }
}

function writeCompleteShardEvidence(
  root,
  shard,
  {
    commitSha = '0123456789abcdef0123456789abcdef01234567',
    configurationSha256 = 'a'.repeat(64),
    nodeVersion = 'v22.18.0',
    mutants = canonicalMutantsForWholeSource(shard),
  } = {},
) {
  writeCompleteShardArtifacts(
    root,
    shard,
    makeShardReport(shard.source, mutants),
  );
  const directory = completeShardDirectory(root, shard.id);
  writeFileSync(join(directory, 'stryker.log'), '', 'utf8');
  const common = {
    profile: 'complete',
    shardId: shard.id,
    source: shard.source,
    commitSha,
    nodeVersion,
    os: 'Linux 6.11 x64',
    sourceSha256: Object.fromEntries(
      SELECTED_SOURCES.map((source) => [
        source,
        MANIFEST.rules.find((rule) => rule.source === source).sourceSha256,
      ]),
    ),
    configurationSha256,
  };
  writeFileSync(
    join(directory, 'duration.json'),
    `${JSON.stringify({
      ...common,
      startedAt: '2026-08-16T10:00:00.000Z',
      finishedAt: '2026-08-16T10:01:00.000Z',
      durationMs: 60000,
      budgetMs: 900000,
      timedOut: false,
      strykerExitCode: 0,
      policyExitCode: 0,
    })}\n`,
    'utf8',
  );
  writeFileSync(
    join(directory, 'summary.json'),
    `${JSON.stringify({
      ...common,
      reportSchemaVersion: '2.0',
      artifactExitCode: 0,
      timedOut: false,
      strykerExitCode: 0,
    })}\n`,
    'utf8',
  );
}

function writeAllCompleteShardEvidence(root) {
  for (const shard of COMPLETE_SHARDS) {
    writeCompleteShardEvidence(root, shard);
  }
}

function writeShardArtifacts(root, shard, report, { html = true } = {}) {
  const directory = shardDirectory(root, shard.id);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, 'mutation.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  if (html) {
    writeFileSync(
      join(directory, 'mutation.html'),
      `<!doctype html><title>${shard.id}</title>\n`,
      'utf8',
    );
  }
}

function writeAllShardArtifacts(root, mutantsBySource = {}) {
  for (const shard of SMOKE_SHARDS) {
    const mutants = canonicalMutantsForWholeSource(shard);
    const replacements = mutantsBySource[shard.source] ?? [];
    if (replacements.length > 0) {
      mutants.splice(0, replacements.length, ...replacements);
    }
    writeWholeSourceEvidence(root, shard, { mutants });
  }
}

function shardedDependencies(root, mutantsBySource = {}, calls = []) {
  let clock = 100;
  let dateTick = 0;
  const replacedSources = new Set();
  return {
    repositoryRoot: root,
    platform: 'linux',
    environment: { KEEP_ME: 'preserved' },
    commitSha: '0123456789abcdef0123456789abcdef01234567',
    nodeVersion: 'v22.18.0',
    os: 'Linux 6.11 x64',
    now() {
      return new Date(Date.UTC(2026, 7, 12, 10, 0, 0, dateTick++));
    },
    performanceNow() {
      const value = clock;
      clock += 10;
      return value;
    },
    spawnProcess(command, args, options) {
      calls.push({ command, args, options });
      const shard = SMOKE_SHARDS.find(
        (entry) => entry.id === options.env.MUTATION_SHARD,
      );
      if (shard) {
        const mutants = canonicalMutantsForWholeSource(shard);
        const replacements = mutantsBySource[shard.source] ?? [];
        if (replacements.length > 0 && !replacedSources.has(shard.source)) {
          mutants.splice(0, replacements.length, ...replacements);
          replacedSources.add(shard.source);
        }
        writeShardArtifacts(
          root,
          shard,
          makeShardReport(shard.source, mutants),
        );
      }
      return fakeChild();
    },
  };
}

function completeShardedDependencies(root, mutantsBySource = {}, calls = []) {
  let clock = 100;
  let dateTick = 0;
  return {
    repositoryRoot: root,
    platform: 'linux',
    environment: { KEEP_ME: 'preserved' },
    commitSha: '0123456789abcdef0123456789abcdef01234567',
    nodeVersion: 'v22.18.0',
    os: 'Linux 6.11 x64',
    now() {
      return new Date(Date.UTC(2026, 7, 16, 10, 0, 0, dateTick++));
    },
    performanceNow() {
      const value = clock;
      clock += 10;
      return value;
    },
    spawnProcess(command, args, options) {
      calls.push({ command, args, options });
      const shard = COMPLETE_SHARDS.find(
        (entry) => entry.id === options.env.MUTATION_SHARD,
      );
      if (shard) {
        writeCompleteShardArtifacts(
          root,
          shard,
          makeShardReport(
            shard.source,
            mutantsBySource[shard.source] ??
              canonicalMutantsForWholeSource(shard),
          ),
        );
      }
      return fakeChild();
    },
  };
}

function fakeChild({ exitCode = 0, onKill } = {}) {
  const child = new EventEmitter();
  child.kill = (signal) => {
    onKill?.(signal, child);
    return true;
  };
  if (exitCode !== null) {
    queueMicrotask(() => child.emit('close', exitCode, null));
  }
  return child;
}

function readArtifact(root, profile, name) {
  return JSON.parse(
    readFileSync(join(root, 'reports', 'mutation', profile, name), 'utf8'),
  );
}

function findPreservedFile(root, name, expectedContents) {
  const pending = [root];
  while (pending.length > 0) {
    const directory = pending.shift();
    if (!existsSync(directory)) {
      continue;
    }
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) {
        pending.push(path);
      } else if (
        entry === name &&
        readFileSync(path, 'utf8').includes(expectedContents)
      ) {
        return path;
      }
    }
  }
  return null;
}

function pidIsAlive(pid) {
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

async function waitForFile(path, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (!existsSync(path)) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for fixture file: ${path}`);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
}

function killExactFixtureTree(pids) {
  if (!pids) {
    return;
  }
  if (process.platform === 'win32') {
    for (const pid of [pids.parent, pids.descendant]) {
      if (Number.isInteger(pid) && pidIsAlive(pid)) {
        spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        });
      }
    }
    return;
  }
  try {
    process.kill(-pids.parent, 'SIGKILL');
  } catch (error) {
    if (error?.code !== 'ESRCH') {
      throw error;
    }
  }
  for (const pid of [pids.parent, pids.descendant]) {
    if (Number.isInteger(pid) && pidIsAlive(pid)) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch (error) {
        if (error?.code !== 'ESRCH') {
          throw error;
        }
      }
    }
  }
}

function realProcessTreeDependencies(root, { ignoreSigterm = false } = {}) {
  const pidFile = join(root, 'fixture-process-tree.json');
  const source = `
    const { spawn } = require('node:child_process');
    const { writeFileSync } = require('node:fs');
    const descendantSource = ${JSON.stringify(
      `${ignoreSigterm ? "process.on('SIGTERM', () => {});" : ''} setInterval(() => {}, 1000);`,
    )};
    ${ignoreSigterm ? "process.on('SIGTERM', () => {});" : ''}
    const descendant = spawn(process.execPath, ['--eval', descendantSource], {
      stdio: 'ignore',
      windowsHide: true,
    });
    writeFileSync(${JSON.stringify(pidFile)}, JSON.stringify({
      parent: process.pid,
      descendant: descendant.pid,
    }));
    setInterval(() => {}, 1000);
  `;
  let fixturePids;
  return {
    pidFile,
    get fixturePids() {
      return fixturePids;
    },
    dependencies: {
      repositoryRoot: root,
      platform: process.platform,
      environment: { KEEP_ME: 'preserved' },
      commitSha: '0123456789abcdef0123456789abcdef01234567',
      nodeVersion: 'v22.18.0',
      os: 'controlled process-tree fixture',
      now: (() => {
        const values = [
          new Date('2026-08-12T10:00:00.000Z'),
          new Date('2026-08-12T10:05:10.001Z'),
        ];
        return () => values.shift();
      })(),
      performanceNow: (() => {
        const values = [100, 310101];
        return () => values.shift();
      })(),
      spawnProcess(_command, _args, options) {
        const child = spawn(process.execPath, ['--eval', source], {
          ...options,
          stdio: 'ignore',
          windowsHide: true,
        });
        void waitForFile(pidFile).then(() => {
          fixturePids = JSON.parse(readFileSync(pidFile, 'utf8'));
        });
        return child;
      },
      scheduleTimeout(callback, delay) {
        return setTimeout(
          callback,
          delay === 350000 || delay === 900000 ? 750 : delay,
        );
      },
      cancelTimeout: clearTimeout,
    },
  };
}

function mergeShardReports(root, shards = SMOKE_SHARDS) {
  return mergeSmokeShardReports({
    repositoryRoot: root,
    manifest: MANIFEST,
    shards,
    shardResults: shards.map((shard) => ({
      shardId: shard.id,
      source: shard.source,
      strykerExitCode: 0,
      timedOut: false,
    })),
  });
}

function mergeCompleteReports(root, shards = COMPLETE_SHARDS) {
  return mergeCompleteShardReports({
    repositoryRoot: root,
    manifest: MANIFEST,
    shards,
    shardResults: shards.map((shard) => ({
      shardId: shard.id,
      source: shard.source,
      strykerExitCode: 0,
      timedOut: false,
    })),
  });
}

// Production break caught: complete sharding narrows a source by manifest range,
// overlaps ownership, or changes the exact five full-source topology.
test('complete profile has five disjoint full-source shards', () => {
  const owned = [];
  for (const shard of COMPLETE_SHARDS) {
    const config = buildStrykerConfig('complete', MANIFEST, shard.id);
    owned.push(...config.mutate);
    assert.deepEqual(config.mutate, [shard.source]);
    assert.equal(config.concurrency, 4);
    const root = `reports/mutation/complete/shards/${shard.id}`;
    assert.equal(config.jsonReporter.fileName, `${root}/mutation.json`);
    assert.equal(config.htmlReporter.fileName, `${root}/mutation.html`);
    assert.equal(config.tempDirName, `${root}/.stryker-tmp`);
  }
  assert.deepEqual(owned, SELECTED_SOURCES);
  assert.equal(new Set(owned).size, 5);
});

// Production break caught: a shard owns another source's rule, omits an owned
// rule or shares its artifacts with another shard.
test('smoke shards own every reviewed rule exactly once with isolated config', () => {
  assert.equal(MANIFEST.rules.length, 89);
  const emitted = [];
  for (const shard of SMOKE_SHARDS) {
    const config = buildStrykerConfig('smoke', MANIFEST, shard.id);
    const expected = MANIFEST.rules.flatMap((rule) => {
      if (rule.source !== shard.source) {
        return [];
      }
      return [`${rule.source}:${rule.startLine}-${rule.endLine}`];
    });
    emitted.push(...config.mutate);

    assert.deepEqual(config.mutate, expected);
    assert.ok(config.mutate.every((range) => range.startsWith(shard.source)));
    const root = `reports/mutation/smoke/shards/${shard.id}`;
    assert.equal(config.jsonReporter.fileName, `${root}/mutation.json`);
    assert.equal(config.htmlReporter.fileName, `${root}/mutation.html`);
    assert.equal(config.tempDirName, `${root}/.stryker-tmp`);
  }
  assert.equal(new Set(emitted).size, emitted.length);
});

// Production break caught: members loses the approved idle-runner four-worker
// setting, or any other whole-source shard changes from two workers.
test('smoke uses the exact five-shard concurrency map', () => {
  const actual = Object.fromEntries(
    SMOKE_SHARDS.map((shard) => [
      shard.id,
      buildStrykerConfig('smoke', MANIFEST, shard.id).concurrency,
    ]),
  );

  assert.deepEqual(actual, {
    'token-session': 2,
    'identifier-repair': 2,
    'identifier-reconciliation': 2,
    members: 4,
    borrowings: 2,
  });
});

// Production break caught: a profile weakens the agreed runner, reporters, or score gate.
test('all shards and complete use exact Jest, reporters, mutators, thresholds, and fixed concurrency', () => {
  const configs = [
    ...SMOKE_SHARDS.map((shard) => ({
      concurrency: shard.concurrency,
      config: buildStrykerConfig('smoke', MANIFEST, shard.id),
    })),
    ...COMPLETE_SHARDS.map((shard) => ({
      concurrency: 4,
      config: buildStrykerConfig('complete', MANIFEST, shard.id),
    })),
  ];
  for (const { concurrency, config } of configs) {
    assert.deepEqual(
      {
        testRunner: config.testRunner,
        coverageAnalysis: config.coverageAnalysis,
        reporters: config.reporters,
        thresholds: config.thresholds,
        concurrency: config.concurrency,
        jest: config.jest,
      },
      {
        testRunner: 'jest',
        coverageAnalysis: 'perTest',
        reporters: ['clear-text', 'progress', 'json', 'html'],
        thresholds: { high: 80, low: 70, break: 70 },
        concurrency,
        jest: {
          projectType: 'custom',
          configFile: 'package.json',
          enableFindRelatedTests: true,
        },
      },
    );
    assert.equal('mutator' in config, false);
    assert.equal('mutatorPlugins' in config, false);
  }
  assert.deepEqual(
    defaultConfig,
    buildStrykerConfig('smoke', MANIFEST, SMOKE_SHARDS[0].id),
  );
});

// Production break caught: module-load configuration silently selects a default profile.
test('module load requires an exact shard for both profiles', () => {
  for (const profile of [undefined, '', 'SMOKE', 'preview']) {
    const script = `${
      profile === undefined
        ? 'delete process.env.MUTATION_PROFILE;'
        : `process.env.MUTATION_PROFILE=${JSON.stringify(profile)};`
    } process.env.MUTATION_SHARD='token-session'; await import('./stryker.config.mjs');`;
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { cwd: REPOSITORY_ROOT, encoding: 'utf8' },
    );
    assert.notEqual(result.status, 0, profile ?? 'missing');
    assert.match(result.stderr, /MUTATION_PROFILE.*smoke.*complete/i);
  }
  for (const [profile, shard] of [
    ['smoke', 'token-session'],
    ['complete', 'token-session'],
  ]) {
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `process.env.MUTATION_PROFILE=${JSON.stringify(profile)}; ${
          shard
            ? `process.env.MUTATION_SHARD=${JSON.stringify(shard)};`
            : 'delete process.env.MUTATION_SHARD;'
        } await import('./stryker.config.mjs');`,
      ],
      { cwd: REPOSITORY_ROOT, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  }
  for (const script of [
    "process.env.MUTATION_PROFILE='smoke'; delete process.env.MUTATION_SHARD;",
    "process.env.MUTATION_PROFILE='smoke'; process.env.MUTATION_SHARD='unknown';",
    "process.env.MUTATION_PROFILE='complete'; delete process.env.MUTATION_SHARD;",
    "process.env.MUTATION_PROFILE='complete'; process.env.MUTATION_SHARD='unknown';",
  ]) {
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `${script} await import('./stryker.config.mjs');`,
      ],
      { cwd: REPOSITORY_ROOT, encoding: 'utf8' },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /MUTATION_SHARD/i);
  }
});

// Production break caught: Node cannot directly spawn the Windows npx.cmd shim
// with shell:false, so the local pinned launcher never reaches Stryker.
test('launches the local npx shim with shell disabled', async () => {
  assert.equal(typeof runnerModule.launchLocalNpx, 'function');
  const child = runnerModule.launchLocalNpx(['--version'], {
    cwd: REPOSITORY_ROOT,
    env: process.env,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const exitCode = await new Promise((resolvePromise, reject) => {
    child.once('error', reject);
    child.once('close', resolvePromise);
  });

  assert.equal(exitCode, 0, stderr);
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
});

// Production break caught: the unchanged complete run loses its 900-second
// deadline or single-tree graceful/forced escalation while smoke is sharded.
test('complete shard retains the 900000 ms deadline and escalation', async () => {
  const profile = 'complete';
  const budgetMs = 900000;
  const root = temporaryRepository();
  const scheduled = [];
  const signals = [];
  const result = await runnerModule.runCompleteShard('token-session', {
    repositoryRoot: root,
    platform: 'linux',
    environment: { KEEP_ME: 'preserved' },
    commitSha: '0123456789abcdef0123456789abcdef01234567',
    nodeVersion: 'v22.18.0',
    os: 'Linux 6.11 x64',
    now: (() => {
      const values = [
        new Date('2026-08-09T10:00:00.000Z'),
        new Date('2026-08-09T10:05:00.001Z'),
      ];
      return () => values.shift();
    })(),
    performanceNow: (() => {
      const values = [50, budgetMs + 51];
      return () => values.shift();
    })(),
    scheduleTimeout(callback, delay) {
      scheduled.push(delay);
      queueMicrotask(callback);
      return { delay };
    },
    cancelTimeout() {},
    spawnProcess() {
      return fakeChild({
        exitCode: null,
        onKill(signal, child) {
          signals.push(signal);
          if (signal === 'SIGKILL') {
            queueMicrotask(() => child.emit('close', null, 'SIGKILL'));
          }
        },
      });
    },
  });

  assert.deepEqual(scheduled, [budgetMs, 10000, 10000]);
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
  assert.equal(result.exitCode, 1);
  const duration = JSON.parse(
    readFileSync(
      join(completeShardDirectory(root, 'token-session'), 'duration.json'),
      'utf8',
    ),
  );
  assert.equal(duration.profile, profile);
  assert.equal(duration.shardId, 'token-session');
  assert.equal(duration.source, SELECTED_SOURCES[0]);
  assert.equal(duration.durationMs, budgetMs + 1);
  assert.equal(duration.budgetMs, budgetMs);
  assert.equal(duration.timedOut, true);
  assert.equal(duration.strykerExitCode, null);
  assert.equal(duration.policyExitCode, 1);
});

// Production break caught: timing out only the npx shim or parent leaves a real
// descendant Stryker/Jest-style worker alive after the runner returns.
test('timeout gracefully terminates and verifies a real descendant process tree', async () => {
  const root = temporaryRepository();
  const fixture = realProcessTreeDependencies(root);
  try {
    const result = await runnerModule.runCompleteShard(
      'token-session',
      fixture.dependencies,
    );
    await waitForFile(fixture.pidFile);
    const pids = JSON.parse(readFileSync(fixture.pidFile, 'utf8'));

    assert.equal(result.exitCode, 1);
    assert.equal(result.timedOut, true);
    assert.equal(result.durationMs, 310001);
    assert.equal(result.policyExitCode, 1);
    assert.equal(pidIsAlive(pids.parent), false);
    assert.equal(pidIsAlive(pids.descendant), false);
  } finally {
    const pids = existsSync(fixture.pidFile)
      ? JSON.parse(readFileSync(fixture.pidFile, 'utf8'))
      : fixture.fixturePids;
    killExactFixtureTree(pids);
  }
});

// Production break caught: a process tree that ignores SIGTERM bypasses the
// exact ten-second grace period or survives the forced cleanup.
test(
  'timeout force-kills a real SIGTERM-resistant process tree after ten seconds',
  { skip: process.platform === 'win32' },
  async () => {
    const root = temporaryRepository();
    const fixture = realProcessTreeDependencies(root, { ignoreSigterm: true });
    const started = Date.now();
    try {
      const result = await runnerModule.runCompleteShard(
        'token-session',
        fixture.dependencies,
      );
      const elapsed = Date.now() - started;
      await waitForFile(fixture.pidFile);
      const pids = JSON.parse(readFileSync(fixture.pidFile, 'utf8'));

      assert.equal(result.exitCode, 1);
      assert.equal(result.timedOut, true);
      assert.equal(result.durationMs, 310001);
      assert.equal(result.policyExitCode, 1);
      assert.ok(
        elapsed >= 10000,
        `forced cleanup occurred after ${elapsed} ms`,
      );
      assert.equal(pidIsAlive(pids.parent), false);
      assert.equal(pidIsAlive(pids.descendant), false);
    } finally {
      const pids = existsSync(fixture.pidFile)
        ? JSON.parse(readFileSync(fixture.pidFile, 'utf8'))
        : fixture.fixturePids;
      killExactFixtureTree(pids);
    }
  },
);

// Production break caught: the wrapper drops provenance, raw score, or policy output.
test('runner writes commit, Node, OS, source hashes, score and policy result', async () => {
  const root = temporaryRepository();
  const calls = [];
  const result = await runMutation(
    'smoke',
    shardedDependencies(root, {}, calls),
  );

  assert.equal(result.exitCode, 0);
  assert.equal(calls.length, 5);
  assert.equal(calls[0].command, 'npx');
  assert.deepEqual(calls[0].args, ['--no-install', 'stryker', 'run']);
  assert.equal(calls[0].options.shell, false);
  assert.equal(calls[0].options.cwd, root);
  assert.equal(calls[0].options.env.KEEP_ME, 'preserved');
  assert.equal(calls[0].options.env.MUTATION_PROFILE, 'smoke');
  assert.deepEqual(
    calls.map((call) => call.options.env.MUTATION_SHARD),
    SMOKE_SHARDS.map((shard) => shard.id),
  );

  const summary = readArtifact(root, 'smoke', 'summary.json');
  assert.equal(summary.commitSha, '0123456789abcdef0123456789abcdef01234567');
  assert.equal(summary.nodeVersion, 'v22.18.0');
  assert.equal(summary.os, 'Linux 6.11 x64');
  assert.equal(summary.rawCombinedScore, 100);
  assert.equal(summary.policyPassed, true);
  assert.equal(summary.policyExitCode, 0);
  assert.deepEqual(Object.keys(summary.sourceSha256), SELECTED_SOURCES);
  for (const hash of Object.values(summary.sourceSha256)) {
    assert.match(hash, /^[0-9a-f]{64}$/);
  }
  assert.match(
    readFileSync(
      join(root, 'reports', 'mutation', 'smoke', 'summary.md'),
      'utf8',
    ),
    /Mutation policy: PASS[\s\S]*Raw combined score: 100\.00%/,
  );
});

// Production break caught: a zero Stryker exit bypasses critical-survivor policy.
test('runner cannot bypass policy enforcement when Stryker exits zero', async () => {
  const root = temporaryRepository();
  const firstRule = MANIFEST.rules[0];
  const report = makeReport({
    [firstRule.source]: [
      {
        id: 'live-survivor',
        mutatorName: 'ConditionalExpression',
        replacement: 'false',
        status: 'Survived',
        location: {
          start: { line: firstRule.startLine, column: 1 },
          end: { line: firstRule.startLine, column: 2 },
        },
      },
    ],
  });

  const result = await runMutation(
    'smoke',
    shardedDependencies(root, {
      [firstRule.source]: report.files[firstRule.source].mutants,
    }),
  );

  assert.equal(
    result.shards.every((shard) => shard.strykerExitCode === 0),
    true,
  );
  assert.equal(result.policyExitCode, 1);
  assert.equal(result.exitCode, 1);
  const summary = readArtifact(root, 'smoke', 'summary.json');
  assert.equal(summary.policyPassed, false);
  assert.equal(summary.criticalFindings.length > 0, true);
  assert.match(
    readFileSync(
      join(root, 'reports', 'mutation', 'smoke', 'summary.md'),
      'utf8',
    ),
    /Mutation policy: FAIL[\s\S]*unapproved/,
  );
});

// Production break caught: sequential evidence records cumulative wall time as
// each shard's duration instead of measuring each process at actual settlement.
test('smoke records each shard duration at its actual settlement', async () => {
  const root = temporaryRepository();
  let elapsedMs = 0;
  let shardIndex = 0;
  const settlementMs = [20, 50, 90, 130, 180];
  const epochMs = Date.parse('2026-08-12T10:00:00.000Z');
  const dependencies = shardedDependencies(root);
  dependencies.now = () => new Date(epochMs + elapsedMs);
  dependencies.performanceNow = () => elapsedMs;
  dependencies.spawnProcess = (_command, _args, options) => {
    const shard = SMOKE_SHARDS.find(
      (entry) => entry.id === options.env.MUTATION_SHARD,
    );
    writeWholeSourceReport(root, shard);
    const child = fakeChild({ exitCode: null });
    const durationMs = settlementMs[shardIndex++];
    queueMicrotask(() => {
      elapsedMs += durationMs;
      child.emit('close', 0, null);
    });
    return child;
  };

  const result = await runMutation('smoke', dependencies);

  assert.equal(result.durationMs, 470);
  let startedMs = 0;
  for (const [index, shard] of SMOKE_SHARDS.entries()) {
    const duration = JSON.parse(
      readFileSync(join(shardDirectory(root, shard.id), 'duration.json')),
    );
    assert.equal(
      duration.startedAt,
      new Date(epochMs + startedMs).toISOString(),
    );
    startedMs += settlementMs[index];
    assert.equal(
      duration.finishedAt,
      new Date(epochMs + startedMs).toISOString(),
    );
    assert.equal(duration.durationMs, settlementMs[index]);
  }
});

// Production break caught: shard report/temp/log paths collide or duration
// evidence is omitted, allowing one process to overwrite another.
test('smoke writes isolated reports, logs, temp paths, and per-shard durations', async () => {
  const root = temporaryRepository();
  const calls = [];
  const result = await runMutation(
    'smoke',
    shardedDependencies(root, {}, calls),
  );

  assert.equal(result.exitCode, 0);
  assert.equal(calls.length, 5);
  for (const shard of SMOKE_SHARDS) {
    const directory = shardDirectory(root, shard.id);
    for (const name of [
      'mutation.json',
      'mutation.html',
      'duration.json',
      'stryker.log',
    ]) {
      assert.equal(
        existsSync(join(directory, name)),
        true,
        `${shard.id}/${name}`,
      );
    }
    const call = calls.find(
      (entry) => entry.options.env.MUTATION_SHARD === shard.id,
    );
    assert.match(
      call.options.mutationLogPath,
      new RegExp(`${shard.id}.+stryker\\.log$`),
    );
  }
});

// Production break caught: merge silently ignores a missing shard report or
// presents an aggregate index when a required shard HTML report is absent.
test('canonical merge fails closed on a missing shard report or HTML', async (t) => {
  await t.test('missing JSON', () => {
    const root = temporaryRepository();
    writeAllShardArtifacts(root);
    rmSync(join(shardDirectory(root, SMOKE_SHARDS[0].id), 'mutation.json'));
    assert.throws(() => mergeShardReports(root), /missing.+mutation\.json/i);
  });
  await t.test('missing HTML', () => {
    const root = temporaryRepository();
    writeAllShardArtifacts(root);
    rmSync(join(shardDirectory(root, SMOKE_SHARDS[1].id), 'mutation.html'));
    assert.throws(() => mergeShardReports(root), /missing.+mutation\.html/i);
  });
});

// Production break caught: a shard mutates the wrong or additional source, or
// the five-source ownership ceases to be a disjoint exact union.
test('canonical merge rejects wrong, extra, or duplicated shard ownership', async (t) => {
  await t.test('wrong shard source', () => {
    const root = temporaryRepository();
    writeAllShardArtifacts(root);
    writeShardArtifacts(
      root,
      SMOKE_SHARDS[0],
      makeShardReport(SMOKE_SHARDS[2].source),
    );
    assert.throws(() => mergeShardReports(root), /source.+token-session/i);
  });
  await t.test('duplicated source assignment', () => {
    const root = temporaryRepository();
    writeAllShardArtifacts(root);
    const invalid = SMOKE_SHARDS.map((shard) => ({ ...shard }));
    invalid[4].source = invalid[3].source;
    assert.throws(
      () => mergeShardReports(root, invalid),
      /topology.+invalid|source.+union|duplicate/i,
    );
  });
});

// Production break caught: report-local ids hide duplicate canonical mutants,
// or a mutant lacking canonical identity fields disappears from the merge.
test('canonical merge rejects duplicate or omitted canonical mutant identity', async (t) => {
  await t.test('duplicate identity with different local ids', () => {
    const root = temporaryRepository();
    writeAllShardArtifacts(root, {
      [SMOKE_SHARDS[0].source]: [
        canonicalMutant(SMOKE_SHARDS[0].source, { id: 'local-a' }),
        canonicalMutant(SMOKE_SHARDS[0].source, { id: 'local-b' }),
      ],
    });
    assert.throws(() => mergeShardReports(root), /duplicate.+canonical/i);
  });
  await t.test('missing replacement identity', () => {
    const root = temporaryRepository();
    const mutant = canonicalMutant(SMOKE_SHARDS[0].source);
    delete mutant.replacement;
    writeAllShardArtifacts(root, {
      [SMOKE_SHARDS[0].source]: [mutant],
    });
    assert.throws(() => mergeShardReports(root), /canonical.+replacement/i);
  });
});

// Production break caught: canonical merge drops a source or rewrites a status
// before Task 2 policy sees the exact five-source union.
test('canonical merge writes five source maps with unmodified statuses and truthful HTML index', () => {
  const root = temporaryRepository();
  const statuses = ['Killed', 'Survived', 'NoCoverage', 'Timeout', 'Ignored'];
  writeAllShardArtifacts(
    root,
    Object.fromEntries(
      SELECTED_SOURCES.map((source, index) => [
        source,
        [canonicalMutant(source, { status: statuses[index] })],
      ]),
    ),
  );

  const result = mergeShardReports(root);
  const report = readArtifact(root, 'smoke', 'mutation.json');
  assert.deepEqual(Object.keys(report.files), SELECTED_SOURCES);
  assert.deepEqual(
    SELECTED_SOURCES.map((source) => report.files[source].mutants[0].status),
    statuses,
  );
  assert.equal(result.canonicalMutantCount, 1366);
  const html = readFileSync(
    join(root, 'reports', 'mutation', 'smoke', 'mutation.html'),
    'utf8',
  );
  assert.match(html, /aggregate index/i);
  for (const shard of SMOKE_SHARDS) {
    assert.match(html, new RegExp(`shards/${shard.id}/mutation\\.html`));
    assert.match(html, new RegExp(shard.source.replaceAll('/', '\\/')));
  }
  assert.doesNotMatch(html, /merged Stryker HTML report/i);
});

// Production break caught: five complete reports plus a one-mutant omission
// pass canonical merge despite violating the observed exact smoke union.
test('canonical merge rejects a 1365-mutant whole-source union', () => {
  const root = temporaryRepository();
  writeAllShardArtifacts(root);
  const shard = SMOKE_SHARDS[0];
  const path = join(shardDirectory(root, shard.id), 'mutation.json');
  const report = JSON.parse(readFileSync(path, 'utf8'));
  report.files[shard.source].mutants.pop();
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  assert.throws(
    () =>
      mergeSmokeShardReports({
        repositoryRoot: root,
        manifest: MANIFEST,
        shards: SMOKE_SHARDS,
        shardResults: [],
      }),
    /1366|canonical mutant union/i,
  );
});

// Production break caught: five zero Stryker exits bypass merged critical
// survivor enforcement by treating shard completion as policy success.
test('merged policy cannot be bypassed by zero shard exits', async () => {
  const root = temporaryRepository();
  const source = SMOKE_SHARDS[0].source;
  const survivor = canonicalMutant(source, {
    id: 'critical-survivor',
    status: 'Survived',
  });
  const result = await runMutation(
    'smoke',
    shardedDependencies(root, { [source]: [survivor] }),
  );

  assert.equal(
    result.shards.every((shard) => shard.strykerExitCode === 0),
    true,
  );
  assert.equal(result.policyExitCode, 1);
  assert.equal(result.exitCode, 1);
  assert.equal(result.criticalFindings.length > 0, true);
});

// Production break caught: smoke subdivides a source by line window or changes
// the approved 2/2/2/4/2 worker map and exact whole-source denominator.
test('distributed smoke config uses the approved whole-source worker map', () => {
  for (const shard of WHOLE_SOURCE_SHARDS) {
    const config = buildStrykerConfig('smoke', MANIFEST, shard.id);
    assert.equal(config.concurrency, shard.concurrency, shard.id);
    assert.deepEqual(
      config.mutate,
      MANIFEST.rules
        .filter((rule) => rule.source === shard.source)
        .map((rule) => `${rule.source}:${rule.startLine}-${rule.endLine}`),
      shard.id,
    );
    assert.equal(
      config.tempDirName,
      `reports/mutation/smoke/shards/${shard.id}/.stryker-tmp`,
    );
  }
  assert.throws(
    () => buildStrykerConfig('smoke', MANIFEST, 'token-session-a'),
    /MUTATION_SHARD.*token-session/i,
  );
});

// Production break caught: named execution starts multiple shards or omits
// evidence needed by a later runner-independent aggregate operation.
test('named smoke shard runs once and writes isolated provenance artifacts', async () => {
  const root = temporaryRepository();
  const calls = [];
  const dependencies = shardedDependencies(root, {}, calls);
  dependencies.spawnProcess = (command, args, options) => {
    calls.push({ command, args, options });
    const shard = WHOLE_SOURCE_SHARDS.find(
      (entry) => entry.id === options.env.MUTATION_SHARD,
    );
    writeWholeSourceReport(root, shard);
    return fakeChild({ exitCode: 1 });
  };

  const result = await runnerModule.runSmokeShard(
    'token-session',
    dependencies,
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.env.MUTATION_SHARD, 'token-session');
  assert.equal(result.artifactExitCode, 0);
  assert.equal(result.timedOut, false);
  const directory = shardDirectory(root, 'token-session');
  for (const name of [
    'mutation.json',
    'mutation.html',
    'duration.json',
    'summary.json',
    'stryker.log',
  ]) {
    assert.equal(existsSync(join(directory, name)), true, name);
  }
  const summary = JSON.parse(readFileSync(join(directory, 'summary.json')));
  assert.equal(summary.commitSha, dependencies.commitSha);
  assert.equal(summary.nodeVersion, dependencies.nodeVersion);
  assert.match(summary.configurationSha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(summary.sourceSha256), SELECTED_SOURCES);
});

// Production break caught: a failed named launch relabels a stale JSON/HTML
// pair as evidence from the current commit instead of failing closed.
test('named smoke shard preserves but rejects stale mutation artifacts', async () => {
  const root = temporaryRepository();
  const shard = WHOLE_SOURCE_SHARDS[0];
  const directory = shardDirectory(root, shard.id);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, 'mutation.json'),
    '{"staleNamedArtifact":true}\n',
    'utf8',
  );
  writeFileSync(
    join(directory, 'mutation.html'),
    '<p>stale named artifact</p>\n',
    'utf8',
  );
  const dependencies = shardedDependencies(root);
  dependencies.spawnProcess = () => fakeChild({ exitCode: 1 });

  const result = await runnerModule.runSmokeShard(shard.id, dependencies);

  assert.equal(result.strykerExitCode, 1);
  assert.equal(result.artifactExitCode, 1);
  assert.equal(result.exitCode, 1);
  assert.equal(result.reportSchemaVersion, null);
  assert.equal(existsSync(join(directory, 'mutation.json')), false);
  assert.equal(existsSync(join(directory, 'mutation.html')), false);
  const history = join(root, 'reports', 'mutation', 'smoke', 'history');
  assert.notEqual(
    findPreservedFile(history, 'mutation.json', 'staleNamedArtifact'),
    null,
  );
  assert.notEqual(
    findPreservedFile(history, 'mutation.html', 'stale named artifact'),
    null,
  );
});

// Production break caught: local evidence launches source shards concurrently
// or shares one five-minute clock instead of giving each shard its own deadline.
test('local smoke evidence runs five shards sequentially with independent budgets', async () => {
  const root = temporaryRepository();
  const calls = [];
  const scheduled = [];
  let active = 0;
  let maximumActive = 0;
  const dependencies = shardedDependencies(root, {}, calls);
  dependencies.spawnProcess = (command, args, options) => {
    calls.push({ command, args, options });
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    const shard = WHOLE_SOURCE_SHARDS.find(
      (entry) => entry.id === options.env.MUTATION_SHARD,
    );
    writeWholeSourceReport(root, shard);
    const child = fakeChild({ exitCode: null });
    queueMicrotask(() => {
      active -= 1;
      child.emit('close', 1, null);
    });
    return child;
  };
  dependencies.scheduleTimeout = (callback, delay) => {
    scheduled.push({ callback, delay });
    return { callback, delay };
  };
  dependencies.cancelTimeout = () => {};

  const result = await runnerModule.runSmokeSequential(dependencies);

  assert.deepEqual(
    calls.map((call) => call.options.env.MUTATION_SHARD),
    WHOLE_SOURCE_SHARDS.map((shard) => shard.id),
  );
  assert.equal(maximumActive, 1);
  assert.equal(scheduled.filter(({ delay }) => delay === 350000).length, 5);
  assert.equal(result.canonicalMutantCount, 1366);
  assert.equal(result.policyExitCode, 0);
  assert.equal(result.referenceBudgetEvidence, false);
});

// Production break caught: sequential or standalone merge leaves stale shard
// and aggregate JSON/HTML active when the current run produces no valid report.
test('sequential and standalone merge preserve stale evidence but invalidate active outputs', async (t) => {
  await t.test('sequential launch writes no reports', async () => {
    const root = temporaryRepository();
    writeAllShardArtifacts(root);
    const aggregate = join(root, 'reports', 'mutation', 'smoke');
    writeFileSync(
      join(aggregate, 'mutation.json'),
      '{"staleSequentialAggregate":true}\n',
      'utf8',
    );
    writeFileSync(
      join(aggregate, 'mutation.html'),
      '<p>stale sequential aggregate</p>\n',
      'utf8',
    );
    const dependencies = shardedDependencies(root);
    dependencies.spawnProcess = () => fakeChild({ exitCode: 1 });

    const result = await runnerModule.runSmokeSequential(dependencies);

    assert.equal(result.exitCode, 1);
    assert.equal(result.canonicalMutantCount, null);
    assert.match(result.policyError, /Missing token-session mutation\.json/);
    assert.equal(
      result.shards.every((shard) => shard.artifactExitCode === 1),
      true,
    );
    for (const shard of WHOLE_SOURCE_SHARDS) {
      assert.equal(
        existsSync(join(shardDirectory(root, shard.id), 'mutation.json')),
        false,
      );
      assert.equal(
        existsSync(join(shardDirectory(root, shard.id), 'mutation.html')),
        false,
      );
    }
    assert.equal(existsSync(join(aggregate, 'mutation.json')), false);
    assert.equal(existsSync(join(aggregate, 'mutation.html')), false);
    const history = join(aggregate, 'history');
    assert.notEqual(
      findPreservedFile(history, 'mutation.json', 'staleSequentialAggregate'),
      null,
    );
    assert.notEqual(
      findPreservedFile(history, 'mutation.html', 'stale sequential aggregate'),
      null,
    );
  });

  await t.test(
    'standalone merge fails before writing a fresh aggregate',
    async () => {
      const root = temporaryRepository();
      for (const shard of WHOLE_SOURCE_SHARDS) {
        writeWholeSourceEvidence(root, shard);
      }
      const aggregate = join(root, 'reports', 'mutation', 'smoke');
      writeFileSync(
        join(aggregate, 'mutation.json'),
        '{"staleStandaloneAggregate":true}\n',
        'utf8',
      );
      writeFileSync(
        join(aggregate, 'mutation.html'),
        '<p>stale standalone aggregate</p>\n',
        'utf8',
      );
      rmSync(
        join(shardDirectory(root, WHOLE_SOURCE_SHARDS[0].id), 'mutation.json'),
      );

      await assert.rejects(
        runnerModule.runSmokeMerge({
          repositoryRoot: root,
          commitSha: '0123456789abcdef0123456789abcdef01234567',
          nodeVersion: 'v22.18.0',
          os: 'Linux 6.11 x64',
        }),
        /Missing token-session mutation\.json/,
      );

      assert.equal(existsSync(join(aggregate, 'mutation.json')), false);
      assert.equal(existsSync(join(aggregate, 'mutation.html')), false);
      const history = join(aggregate, 'history');
      assert.notEqual(
        findPreservedFile(history, 'mutation.json', 'staleStandaloneAggregate'),
        null,
      );
      assert.notEqual(
        findPreservedFile(
          history,
          'mutation.html',
          'stale standalone aggregate',
        ),
        null,
      );
    },
  );
});

// Production break caught: aggregation accepts reports from different commits,
// Node majors, source snapshots, or configuration identities.
test('whole-source merge rejects mismatched shard provenance', () => {
  const root = temporaryRepository();
  for (const shard of WHOLE_SOURCE_SHARDS) {
    writeWholeSourceEvidence(root, shard);
  }
  writeWholeSourceEvidence(root, WHOLE_SOURCE_SHARDS[4], {
    commitSha: 'fedcba9876543210fedcba9876543210fedcba98',
  });

  assert.throws(
    () =>
      mergeSmokeShardReports({
        repositoryRoot: root,
        manifest: MANIFEST,
        shards: WHOLE_SOURCE_SHARDS,
        shardResults: [],
      }),
    /provenance|commit/i,
  );
});

// Production break caught: whole-source aggregation omits or duplicates one
// canonical identity instead of returning the exact five-source 1366 union.
test('whole-source merge returns five files and exactly 1366 identities', () => {
  const root = temporaryRepository();
  for (const shard of WHOLE_SOURCE_SHARDS) {
    writeWholeSourceEvidence(root, shard);
  }

  const result = mergeSmokeShardReports({
    repositoryRoot: root,
    manifest: MANIFEST,
    shards: WHOLE_SOURCE_SHARDS,
    shardResults: [],
  });

  assert.equal(result.canonicalMutantCount, 1366);
  assert.deepEqual(Object.keys(result.report.files), SELECTED_SOURCES);
});

// Production break caught: the runner-independent merge writes a policy file
// with undefined local-run fields instead of truthful distributed evidence.
test('whole-source merge writes a complete distributed policy summary', async () => {
  const root = temporaryRepository();
  for (const shard of WHOLE_SOURCE_SHARDS) {
    writeWholeSourceEvidence(root, shard);
  }

  const result = await runnerModule.runSmokeMerge({
    repositoryRoot: root,
    commitSha: '0123456789abcdef0123456789abcdef01234567',
    nodeVersion: 'v22.18.0',
    os: 'Linux 6.11 x64',
  });
  const summary = readArtifact(root, 'smoke', 'summary.json');
  const markdown = readFileSync(
    join(root, 'reports', 'mutation', 'smoke', 'summary.md'),
    'utf8',
  );

  assert.equal(result.exitCode, 0);
  assert.equal(summary.nodeMajor, 22);
  assert.equal(summary.maxShardDurationMs, 60000);
  assert.equal(summary.budgetMs, 350000);
  assert.equal(summary.referenceBudgetEvidence, false);
  assert.deepEqual(
    summary.shards.map((shard) => shard.shardId),
    WHOLE_SOURCE_SHARDS.map((shard) => shard.id),
  );
  assert.match(markdown, /Node major: 22/);
  assert.match(markdown, /Maximum shard duration: 60000 ms \/ 350000 ms/);
  assert.doesNotMatch(markdown, /undefined/);
});

// Production break caught: complete execution starts the five-source producer
// or writes into a shared aggregate path instead of exactly one owned shard.
test('named complete shard runs once with isolated 900000 ms evidence', async () => {
  const root = temporaryRepository();
  const calls = [];
  const scheduled = [];
  const dependencies = completeShardedDependencies(root, {}, calls);
  dependencies.scheduleTimeout = (callback, delay) => {
    scheduled.push(delay);
    return { callback, delay };
  };
  dependencies.cancelTimeout = () => {};

  const result = await runnerModule.runCompleteShard(
    'token-session',
    dependencies,
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.env.MUTATION_PROFILE, 'complete');
  assert.equal(calls[0].options.env.MUTATION_SHARD, 'token-session');
  assert.deepEqual(scheduled, [900000]);
  assert.equal(result.artifactExitCode, 0);
  assert.equal(result.timedOut, false);
  const directory = completeShardDirectory(root, 'token-session');
  for (const name of [
    'mutation.json',
    'mutation.html',
    'duration.json',
    'summary.json',
    'stryker.log',
  ]) {
    assert.equal(existsSync(join(directory, name)), true, name);
  }
  const summary = JSON.parse(readFileSync(join(directory, 'summary.json')));
  assert.equal(summary.profile, 'complete');
  assert.equal(summary.shardId, 'token-session');
  assert.equal(summary.source, SELECTED_SOURCES[0]);
  assert.equal(summary.commitSha, dependencies.commitSha);
  assert.equal(summary.nodeVersion, dependencies.nodeVersion);
});

// Production break caught: a failed complete shard relabels stale JSON/HTML as
// evidence from the current process instead of preserving and rejecting it.
test('named complete shard preserves but rejects stale mutation artifacts', async () => {
  const root = temporaryRepository();
  const shard = COMPLETE_SHARDS[0];
  const directory = completeShardDirectory(root, shard.id);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, 'mutation.json'),
    '{"staleCompleteShard":true}\n',
    'utf8',
  );
  writeFileSync(
    join(directory, 'mutation.html'),
    '<p>stale complete shard</p>\n',
    'utf8',
  );
  const dependencies = completeShardedDependencies(root);
  dependencies.spawnProcess = () => fakeChild({ exitCode: 1 });

  const result = await runnerModule.runCompleteShard(shard.id, dependencies);

  assert.equal(result.strykerExitCode, 1);
  assert.equal(result.artifactExitCode, 1);
  assert.equal(result.exitCode, 1);
  assert.equal(existsSync(join(directory, 'mutation.json')), false);
  assert.equal(existsSync(join(directory, 'mutation.html')), false);
  const history = join(root, 'reports', 'mutation', 'complete', 'history');
  assert.notEqual(
    findPreservedFile(history, 'mutation.json', 'staleCompleteShard'),
    null,
  );
  assert.notEqual(
    findPreservedFile(history, 'mutation.html', 'stale complete shard'),
    null,
  );
});

// Production break caught: complete merge trusts report-local mutant ids,
// accepts mixed provenance, or omits part of the preserved 1,727 denominator.
test('complete canonical merge is id-independent and requires exact provenance and 1727 union', async (t) => {
  await t.test('exact five-source union', () => {
    const root = temporaryRepository();
    writeAllCompleteShardEvidence(root);

    const result = mergeCompleteReports(root);

    assert.equal(result.canonicalMutantCount, 1727);
    assert.deepEqual(Object.keys(result.report.files), SELECTED_SOURCES);
  });

  await t.test('duplicate identity with different local ids', () => {
    const root = temporaryRepository();
    writeAllCompleteShardEvidence(root);
    const shard = COMPLETE_SHARDS[0];
    const path = join(completeShardDirectory(root, shard.id), 'mutation.json');
    const report = JSON.parse(readFileSync(path, 'utf8'));
    report.files[shard.source].mutants[1] = {
      ...report.files[shard.source].mutants[0],
      id: 'different-report-local-id',
    };
    writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    assert.throws(() => mergeCompleteReports(root), /duplicate.+canonical/i);
  });

  await t.test('one omitted mutant', () => {
    const root = temporaryRepository();
    writeAllCompleteShardEvidence(root);
    const shard = COMPLETE_SHARDS[4];
    const path = join(completeShardDirectory(root, shard.id), 'mutation.json');
    const report = JSON.parse(readFileSync(path, 'utf8'));
    report.files[shard.source].mutants.pop();
    writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    assert.throws(
      () => mergeCompleteReports(root),
      /1727|canonical mutant union/i,
    );
  });

  await t.test('mixed commit provenance', () => {
    const root = temporaryRepository();
    writeAllCompleteShardEvidence(root);
    writeCompleteShardEvidence(root, COMPLETE_SHARDS[2], {
      commitSha: 'fedcba9876543210fedcba9876543210fedcba98',
    });

    assert.throws(() => mergeCompleteReports(root), /provenance|commit/i);
  });
});

// Production break caught: standalone complete merge leaves stale aggregate
// outputs active or invokes policy on a structurally incomplete shard set.
test('complete merge fails closed on missing current artifacts', async () => {
  const root = temporaryRepository();
  writeAllCompleteShardEvidence(root);
  const aggregate = join(root, 'reports', 'mutation', 'complete');
  writeFileSync(
    join(aggregate, 'mutation.json'),
    '{"staleCompleteAggregate":true}\n',
    'utf8',
  );
  writeFileSync(
    join(aggregate, 'mutation.html'),
    '<p>stale complete aggregate</p>\n',
    'utf8',
  );
  rmSync(
    join(completeShardDirectory(root, COMPLETE_SHARDS[0].id), 'mutation.json'),
  );

  await assert.rejects(
    runnerModule.runCompleteMerge({
      repositoryRoot: root,
      commitSha: '0123456789abcdef0123456789abcdef01234567',
      nodeVersion: 'v22.18.0',
      os: 'Linux 6.11 x64',
    }),
    /Missing token-session mutation\.json/,
  );

  assert.equal(existsSync(join(aggregate, 'mutation.json')), false);
  assert.equal(existsSync(join(aggregate, 'mutation.html')), false);
  const history = join(aggregate, 'history');
  assert.notEqual(
    findPreservedFile(history, 'mutation.json', 'staleCompleteAggregate'),
    null,
  );
  assert.notEqual(
    findPreservedFile(history, 'mutation.html', 'stale complete aggregate'),
    null,
  );
});

// Production break caught: complete distributed evidence skips the one merged
// Task 2 policy evaluation or writes smoke/monolithic provenance fields.
test('complete merge writes one canonical policy summary for all five shards', async () => {
  const root = temporaryRepository();
  writeAllCompleteShardEvidence(root);

  const result = await runnerModule.runCompleteMerge({
    repositoryRoot: root,
    commitSha: '0123456789abcdef0123456789abcdef01234567',
    nodeVersion: 'v22.18.0',
    os: 'Linux 6.11 x64',
  });
  const summary = readArtifact(root, 'complete', 'summary.json');

  assert.equal(result.exitCode, 0);
  assert.equal(result.canonicalMutantCount, 1727);
  assert.equal(result.policyExitCode, 0);
  assert.equal(summary.profile, 'complete');
  assert.equal(summary.nodeMajor, 22);
  assert.equal(summary.maxShardDurationMs, 60000);
  assert.equal(summary.budgetMs, 900000);
  assert.deepEqual(
    summary.shards.map((shard) => shard.shardId),
    COMPLETE_SHARDS.map((shard) => shard.id),
  );
});

// Production break caught: named-shard timeout returns while its exact child
// process group or descendant remains alive.
test('named smoke shard timeout cleans its exact real process tree', async () => {
  const root = temporaryRepository();
  const fixture = realProcessTreeDependencies(root);
  try {
    const result = await runnerModule.runSmokeShard(
      'token-session',
      fixture.dependencies,
    );
    await waitForFile(fixture.pidFile);
    const pids = JSON.parse(readFileSync(fixture.pidFile));
    assert.equal(result.timedOut, true);
    assert.equal(pidIsAlive(pids.parent), false);
    assert.equal(pidIsAlive(pids.descendant), false);
  } finally {
    killExactFixtureTree(fixture.fixturePids);
  }
});

// Production break caught: generated mutation evidence can enter a source commit.
test('mutation report directory is ignored by Git', () => {
  const lines = readFileSync(join(REPOSITORY_ROOT, '.gitignore'), 'utf8').split(
    /\r?\n/,
  );
  assert.equal(lines.filter((line) => line === '/reports/mutation/').length, 1);
});
