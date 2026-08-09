import { createHash } from 'node:crypto';

const SELECTED_SOURCES = [
  'src/auth/token-session.service.ts',
  'src/auth/auth-identifier-repair.service.ts',
  'src/auth/auth-identifier-reconciliation.service.ts',
  'src/members/members.service.ts',
  'src/borrowings/borrowings.service.ts',
];

const DETECTED_STATUSES = new Set([
  'Killed',
  'Timeout',
  'CompileError',
  'RuntimeError',
]);
const UNDETECTED_STATUSES = new Set(['Survived', 'NoCoverage']);
const ACCEPTED_STATUSES = new Set([
  ...DETECTED_STATUSES,
  ...UNDETECTED_STATUSES,
  'Ignored',
]);
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function fail(message) {
  throw new TypeError(message);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requirePlainObject(value, label) {
  if (!isPlainObject(value)) {
    fail(`${label} must be an object.`);
  }
}

function requireExactKeys(value, expected, label) {
  requirePlainObject(value, label);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    fail(`${label} must contain exactly these fields: ${wanted.join(', ')}.`);
  }
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${label} must be a non-empty string.`);
  }
}

function requireSha256(value, label) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    fail(`${label} must be a 64-character lowercase SHA-256.`);
  }
}

function requireTrackedPath(value, label) {
  requireNonEmptyString(value, label);
  if (value.includes('\\')) {
    fail(`${label} must use forward slashes.`);
  }
  if (
    value.startsWith('/') ||
    value.endsWith('/') ||
    value
      .split('/')
      .some((part) => part === '' || part === '.' || part === '..')
  ) {
    fail(`${label} must be a normalized repository-relative path.`);
  }
}

function parseIsoUtc(value, label) {
  if (typeof value !== 'string' || !ISO_UTC_PATTERN.test(value)) {
    fail(`${label} must be an ISO-8601 UTC timestamp.`);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    fail(`${label} must be an ISO-8601 UTC timestamp.`);
  }
  return timestamp;
}

function stableObject(value) {
  if (Array.isArray(value)) {
    return value.map(stableObject);
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableObject(value[key])]),
    );
  }
  return value;
}

function requirePosition(position, label) {
  requireExactKeys(position, ['line', 'column'], label);
  if (!Number.isInteger(position.line) || position.line < 1) {
    fail(`${label} location line must be a positive integer.`);
  }
  if (!Number.isInteger(position.column) || position.column < 1) {
    fail(`${label} location column must be a positive integer.`);
  }
}

function requireLocation(location, label) {
  requireExactKeys(location, ['start', 'end'], `${label} location`);
  requirePosition(location.start, `${label} start`);
  requirePosition(location.end, `${label} end`);
  const startsBeforeEnd =
    location.start.line < location.end.line ||
    (location.start.line === location.end.line &&
      location.start.column < location.end.column);
  if (!startsBeforeEnd) {
    fail(`${label} location must have an exclusive end after its start.`);
  }
}

function requireLocationWithinSource(location, sourceText, label) {
  const lines = sourceText.split(/\r\n|\r|\n/);
  for (const [positionName, position] of [
    ['start', location.start],
    ['end', location.end],
  ]) {
    if (position.line > lines.length) {
      fail(`${label} ${positionName} location line exceeds its source.`);
    }
    if (position.column > lines[position.line - 1].length + 1) {
      fail(`${label} ${positionName} location column exceeds its source.`);
    }
  }
}

function validateRuleShape(rule, index) {
  const label = `manifest.rules[${index}]`;
  requireExactKeys(
    rule,
    [
      'id',
      'invariant',
      'source',
      'sourceSha256',
      'startLine',
      'endLine',
      'startAnchor',
      'endAnchor',
    ],
    label,
  );
  requireNonEmptyString(rule.id, `${label}.id`);
  requireNonEmptyString(rule.invariant, `${label}.invariant`);
  requireTrackedPath(rule.source, `${label}.source`);
  if (!SELECTED_SOURCES.includes(rule.source)) {
    fail(`${label}.source is not one of the five selected files.`);
  }
  requireSha256(rule.sourceSha256, `${label}.sourceSha256`);
  for (const field of ['startLine', 'endLine']) {
    if (!Number.isInteger(rule[field]) || rule[field] < 1) {
      fail(`${label}.${field} must be a positive integer.`);
    }
  }
  if (rule.startLine > rule.endLine) {
    fail(`${label} range must satisfy startLine <= endLine.`);
  }
  requireNonEmptyString(rule.startAnchor, `${label}.startAnchor`);
  requireNonEmptyString(rule.endAnchor, `${label}.endAnchor`);
}

function validateManifestShape(manifest) {
  requireExactKeys(manifest, ['schemaVersion', 'rules'], 'manifest');
  if (manifest.schemaVersion !== 1) {
    fail('manifest.schemaVersion must equal 1.');
  }
  if (!Array.isArray(manifest.rules) || manifest.rules.length === 0) {
    fail('manifest.rules must be a non-empty array.');
  }

  const ids = new Set();
  const sources = new Set();
  manifest.rules.forEach((rule, index) => {
    validateRuleShape(rule, index);
    if (ids.has(rule.id)) {
      fail(`manifest rule id ${rule.id} is duplicated.`);
    }
    ids.add(rule.id);
    sources.add(rule.source);
  });
  if (
    sources.size !== SELECTED_SOURCES.length ||
    SELECTED_SOURCES.some((source) => !sources.has(source))
  ) {
    fail(
      'manifest must contain at least one rule for exactly the five selected files.',
    );
  }
}

function manifestHashes(manifest) {
  const hashes = new Map();
  for (const rule of manifest.rules) {
    const existing = hashes.get(rule.source);
    if (existing !== undefined && existing !== rule.sourceSha256) {
      fail(`manifest has inconsistent sourceSha256 values for ${rule.source}.`);
    }
    hashes.set(rule.source, rule.sourceSha256);
  }
  return hashes;
}

function scoreCounts(mutants) {
  let detected = 0;
  let undetected = 0;
  let ignored = 0;
  for (const mutant of mutants) {
    if (DETECTED_STATUSES.has(mutant.status)) {
      detected += 1;
    } else if (UNDETECTED_STATUSES.has(mutant.status)) {
      undetected += 1;
    } else if (mutant.status === 'Ignored') {
      ignored += 1;
    }
  }
  const denominator = detected + undetected;
  return {
    detected,
    undetected,
    ignored,
    rawScore: denominator === 0 ? 100 : (100 * detected) / denominator,
  };
}

function validateMutant(mutant, source, sourceText, index) {
  const label = `report.files[${JSON.stringify(source)}].mutants[${index}]`;
  requirePlainObject(mutant, label);
  const allowedKeys = new Set([
    'coveredBy',
    'description',
    'duration',
    'id',
    'killedBy',
    'location',
    'mutatorName',
    'replacement',
    'static',
    'status',
    'statusReason',
    'testsCompleted',
  ]);
  for (const key of Object.keys(mutant)) {
    if (!allowedKeys.has(key)) {
      fail(`${label} contains unknown field ${key}.`);
    }
  }
  requireNonEmptyString(mutant.id, `${label}.id`);
  requireNonEmptyString(mutant.mutatorName, `${label}.mutatorName`);
  if (
    mutant.replacement !== undefined &&
    typeof mutant.replacement !== 'string'
  ) {
    fail(`${label}.replacement must be a string when present.`);
  }
  if (
    typeof mutant.status !== 'string' ||
    !ACCEPTED_STATUSES.has(mutant.status)
  ) {
    fail(`${label}.status is malformed or unsupported.`);
  }
  requireLocation(mutant.location, label);
  requireLocationWithinSource(mutant.location, sourceText, label);
}

function validateReport(report) {
  requirePlainObject(report, 'report');
  if (
    typeof report.schemaVersion !== 'string' ||
    !/^[12](?:\.\d+){0,2}$/.test(report.schemaVersion)
  ) {
    fail('report.schemaVersion is malformed or unsupported.');
  }
  requirePlainObject(report.thresholds, 'report.thresholds');
  if (
    !Number.isFinite(report.thresholds.high) ||
    !Number.isFinite(report.thresholds.low)
  ) {
    fail('report.thresholds must contain numeric high and low values.');
  }
  requirePlainObject(report.files, 'report.files');
  const reportSources = Object.keys(report.files);
  for (const source of reportSources) {
    requireTrackedPath(source, 'report file path');
  }
  if (
    reportSources.length !== SELECTED_SOURCES.length ||
    SELECTED_SOURCES.some((source) => !reportSources.includes(source))
  ) {
    fail('report mutated file set must be exactly the five selected files.');
  }

  for (const source of SELECTED_SOURCES) {
    const file = report.files[source];
    requireExactKeys(
      file,
      ['language', 'source', 'mutants'],
      `report.files[${source}]`,
    );
    requireNonEmptyString(file.language, `report.files[${source}].language`);
    if (typeof file.source !== 'string') {
      fail(`report.files[${source}].source must be a string.`);
    }
    if (!Array.isArray(file.mutants)) {
      fail(`report.files[${source}].mutants must be an array.`);
    }
    const ids = new Set();
    file.mutants.forEach((mutant, index) => {
      validateMutant(mutant, source, file.source, index);
      if (ids.has(mutant.id)) {
        fail(
          `report.files[${source}] contains duplicate mutant id ${mutant.id}.`,
        );
      }
      ids.add(mutant.id);
    });
  }
}

function validateBaseline(baseline, manifest) {
  requireExactKeys(
    baseline,
    [
      'schemaVersion',
      'profile',
      'rawCombinedScore',
      'generatedFromCommit',
      'generatedAt',
      'selectedSources',
      'sourceSha256',
    ],
    'baseline',
  );
  if (baseline.schemaVersion !== 1) {
    fail('baseline.schemaVersion must equal 1.');
  }
  if (baseline.profile !== 'complete') {
    fail('baseline.profile must equal complete.');
  }
  if (
    !Number.isFinite(baseline.rawCombinedScore) ||
    baseline.rawCombinedScore < 70 ||
    baseline.rawCombinedScore > 100
  ) {
    fail('baseline.rawCombinedScore must be between 70 and 100.');
  }
  if (
    typeof baseline.generatedFromCommit !== 'string' ||
    !COMMIT_PATTERN.test(baseline.generatedFromCommit)
  ) {
    fail(
      'baseline.generatedFromCommit must be a 40-character lowercase commit SHA.',
    );
  }
  parseIsoUtc(baseline.generatedAt, 'baseline.generatedAt');
  if (
    !Array.isArray(baseline.selectedSources) ||
    baseline.selectedSources.length !== SELECTED_SOURCES.length ||
    SELECTED_SOURCES.some(
      (source, index) => baseline.selectedSources[index] !== source,
    )
  ) {
    fail(
      'baseline.selectedSources must be the exact ordered five selected files.',
    );
  }
  requirePlainObject(baseline.sourceSha256, 'baseline.sourceSha256');
  const hashSources = Object.keys(baseline.sourceSha256);
  if (
    hashSources.length !== SELECTED_SOURCES.length ||
    SELECTED_SOURCES.some((source) => !hashSources.includes(source))
  ) {
    fail('baseline.sourceSha256 must name exactly the five selected files.');
  }
  const currentHashes = manifestHashes(manifest);
  for (const source of SELECTED_SOURCES) {
    requireSha256(
      baseline.sourceSha256[source],
      `baseline.sourceSha256[${source}]`,
    );
    if (baseline.sourceSha256[source] !== currentHashes.get(source)) {
      fail(`baseline.sourceSha256 is stale for ${source}.`);
    }
  }
}

function mutantLineRange(location) {
  return {
    startLine: location.start.line,
    endLine: location.end.line,
  };
}

function overlapsRule(mutant, rule) {
  const range = mutantLineRange(mutant.location);
  return range.startLine <= rule.endLine && range.endLine >= rule.startLine;
}

export function sha256Text(text) {
  if (typeof text !== 'string') {
    fail('sha256Text text must be a string.');
  }
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function mutantFingerprint(mutant, sourceSha256) {
  requirePlainObject(mutant, 'mutant');
  requireSha256(sourceSha256, 'sourceSha256');
  requireNonEmptyString(mutant.source, 'mutant.source');
  const normalizedSource = mutant.source.replaceAll('\\', '/');
  requireTrackedPath(normalizedSource, 'mutant.source');
  requireNonEmptyString(mutant.mutatorName, 'mutant.mutatorName');
  if (
    mutant.replacement !== undefined &&
    typeof mutant.replacement !== 'string'
  ) {
    fail('mutant.replacement must be a string when present.');
  }
  requireLocation(mutant.location, 'mutant');
  const canonical = stableObject({
    source: normalizedSource,
    mutatorName: mutant.mutatorName,
    replacement: mutant.replacement ?? '',
    startLine: mutant.location.start.line,
    startColumn: mutant.location.start.column,
    endLine: mutant.location.end.line,
    endColumn: mutant.location.end.column,
    sourceSha256,
  });
  return sha256Text(JSON.stringify(canonical));
}

export function validateCriticalManifest(manifest, sourceByPath) {
  validateManifestShape(manifest);
  if (!(sourceByPath instanceof Map)) {
    fail('sourceByPath must be a Map.');
  }
  if (
    sourceByPath.size !== SELECTED_SOURCES.length ||
    SELECTED_SOURCES.some((source) => !sourceByPath.has(source))
  ) {
    fail('sourceByPath must contain exactly the five selected files.');
  }

  for (const [index, rule] of manifest.rules.entries()) {
    const text = sourceByPath.get(rule.source);
    if (typeof text !== 'string') {
      fail(`sourceByPath entry for ${rule.source} must be a string.`);
    }
    if (sha256Text(text) !== rule.sourceSha256) {
      fail(`manifest.rules[${index}] has a stale sourceSha256.`);
    }
    const lines = text.split(/\r?\n/);
    if (rule.endLine > lines.length) {
      fail(`manifest.rules[${index}] range exceeds its source.`);
    }
    if (lines[rule.startLine - 1] !== rule.startAnchor) {
      fail(
        `manifest.rules[${index}].startAnchor does not match its source line.`,
      );
    }
    if (lines[rule.endLine - 1] !== rule.endAnchor) {
      fail(
        `manifest.rules[${index}].endAnchor does not match its source line.`,
      );
    }
    if (lines.filter((line) => line === rule.startAnchor).length !== 1) {
      fail(`manifest.rules[${index}].startAnchor is not unique.`);
    }
    if (lines.filter((line) => line === rule.endAnchor).length !== 1) {
      fail(`manifest.rules[${index}].endAnchor is not unique.`);
    }
  }
  return structuredClone(manifest);
}

export function validateEquivalentAllowlist(allowlist, manifest, nowIso) {
  validateManifestShape(manifest);
  requireExactKeys(allowlist, ['schemaVersion', 'entries'], 'allowlist');
  if (allowlist.schemaVersion !== 1) {
    fail('allowlist.schemaVersion must equal 1.');
  }
  if (!Array.isArray(allowlist.entries)) {
    fail('allowlist.entries must be an array.');
  }
  const now = parseIsoUtc(nowIso, 'nowIso');
  const rules = new Map(manifest.rules.map((rule) => [rule.id, rule]));
  const identities = new Set();

  allowlist.entries.forEach((entry, index) => {
    const label = `allowlist.entries[${index}]`;
    requireExactKeys(
      entry,
      [
        'fingerprint',
        'ruleId',
        'sourceSha256',
        'proof',
        'reviewerModel',
        'reviewerReasoning',
        'reviewedAt',
        'expiresAt',
      ],
      label,
    );
    if (
      entry.fingerprint === '*' ||
      entry.ruleId === '*' ||
      entry.sourceSha256 === '*'
    ) {
      fail(`${label} must not contain wildcard values.`);
    }
    requireSha256(entry.fingerprint, `${label}.fingerprint`);
    requireNonEmptyString(entry.ruleId, `${label}.ruleId`);
    requireSha256(entry.sourceSha256, `${label}.sourceSha256`);
    requireNonEmptyString(entry.proof, `${label}.proof`);
    requireNonEmptyString(entry.reviewerModel, `${label}.reviewerModel`);
    requireNonEmptyString(
      entry.reviewerReasoning,
      `${label}.reviewerReasoning`,
    );
    const rule = rules.get(entry.ruleId);
    if (rule === undefined) {
      fail(`${label}.ruleId does not name exactly one manifest rule.`);
    }
    if (entry.sourceSha256 !== rule.sourceSha256) {
      fail(`${label}.sourceSha256 does not match its manifest rule.`);
    }
    const reviewedAt = parseIsoUtc(entry.reviewedAt, `${label}.reviewedAt`);
    const expiresAt = parseIsoUtc(entry.expiresAt, `${label}.expiresAt`);
    if (reviewedAt > now) {
      fail(`${label}.reviewedAt must not be in the future.`);
    }
    if (expiresAt <= now) {
      fail(`${label} is expired.`);
    }
    if (expiresAt <= reviewedAt || expiresAt - reviewedAt > 90 * DAY_MS) {
      fail(
        `${label}.expiresAt must be after review and no more than 90 days later.`,
      );
    }
    const identity = `${entry.ruleId}:${entry.fingerprint}`;
    if (identities.has(identity)) {
      fail(`${label} duplicates an equivalent fingerprint and rule id.`);
    }
    identities.add(identity);
  });
  return structuredClone(allowlist);
}

export function evaluateMutationReport({
  profile,
  report,
  manifest,
  allowlist,
  baseline,
}) {
  if (profile !== 'smoke' && profile !== 'complete') {
    fail('profile must be exactly smoke or complete.');
  }
  validateReport(report);
  const sourceByPath = new Map(
    SELECTED_SOURCES.map((source) => [source, report.files[source].source]),
  );
  const validManifest = validateCriticalManifest(manifest, sourceByPath);
  const validAllowlist = validateEquivalentAllowlist(
    allowlist,
    validManifest,
    new Date().toISOString(),
  );
  if (baseline !== null) {
    validateBaseline(baseline, validManifest);
  }

  const moduleScores = SELECTED_SOURCES.map((source) => {
    const counts = scoreCounts(report.files[source].mutants);
    return { source, ...counts };
  });
  const detected = moduleScores.reduce(
    (total, item) => total + item.detected,
    0,
  );
  const undetected = moduleScores.reduce(
    (total, item) => total + item.undetected,
    0,
  );
  const ignored = moduleScores.reduce((total, item) => total + item.ignored, 0);
  const denominator = detected + undetected;
  const rawCombinedScore =
    denominator === 0 ? 100 : (100 * detected) / denominator;
  const violations = [];
  if (rawCombinedScore < 70) {
    violations.push(
      `Raw combined mutation score ${rawCombinedScore.toFixed(2)} is below 70.00.`,
    );
  }
  if (
    profile === 'complete' &&
    baseline !== null &&
    rawCombinedScore < baseline.rawCombinedScore
  ) {
    violations.push(
      `Complete raw mutation score ${rawCombinedScore.toFixed(2)} is below baseline ${baseline.rawCombinedScore.toFixed(2)}.`,
    );
  }

  const allowlistIndex = new Set(
    validAllowlist.entries.map(
      (entry) => `${entry.ruleId}:${entry.fingerprint}:${entry.sourceSha256}`,
    ),
  );
  const hashes = manifestHashes(validManifest);
  const criticalFindings = [];
  for (const source of SELECTED_SOURCES) {
    const rules = validManifest.rules.filter((rule) => rule.source === source);
    for (const mutant of report.files[source].mutants) {
      if (!UNDETECTED_STATUSES.has(mutant.status)) {
        continue;
      }
      for (const rule of rules) {
        if (!overlapsRule(mutant, rule)) {
          continue;
        }
        const fingerprint = mutantFingerprint(
          { ...mutant, source },
          hashes.get(source),
        );
        const equivalent = allowlistIndex.has(
          `${rule.id}:${fingerprint}:${rule.sourceSha256}`,
        );
        const manifestLine = Math.max(
          rule.startLine,
          mutantLineRange(mutant.location).startLine,
        );
        criticalFindings.push({
          source,
          mutantId: mutant.id,
          status: mutant.status,
          ruleId: rule.id,
          fingerprint,
          manifestLine,
          equivalent,
        });
        if (!equivalent) {
          violations.push(
            `Critical mutant ${fingerprint} (${mutant.status}) is not an approved equivalent for ${rule.id}.`,
          );
        }
      }
    }
  }

  return {
    profile,
    passed: violations.length === 0,
    rawCombinedScore,
    detected,
    undetected,
    ignored,
    moduleScores,
    criticalFindings,
    violations,
  };
}

export function formatPolicySummary(evaluation) {
  requirePlainObject(evaluation, 'evaluation');
  if (
    typeof evaluation.passed !== 'boolean' ||
    !Number.isFinite(evaluation.rawCombinedScore) ||
    !Array.isArray(evaluation.moduleScores) ||
    !Array.isArray(evaluation.criticalFindings) ||
    !Array.isArray(evaluation.violations)
  ) {
    fail('evaluation is malformed.');
  }
  const lines = [
    `Mutation policy: ${evaluation.passed ? 'PASS' : 'FAIL'}`,
    `Profile: ${evaluation.profile}`,
    `Raw combined score: ${evaluation.rawCombinedScore.toFixed(2)}%`,
    'Module scores:',
    ...evaluation.moduleScores.map(
      (module) =>
        `- ${module.source}: ${module.rawScore.toFixed(2)}% (${module.detected} detected, ${module.undetected} undetected, ${module.ignored} ignored)`,
    ),
    'Critical findings:',
  ];
  if (evaluation.criticalFindings.length === 0) {
    lines.push('- none');
  } else {
    lines.push(
      ...evaluation.criticalFindings.map(
        (finding) =>
          `- ${finding.ruleId}: ${finding.status} ${finding.fingerprint} (${finding.equivalent ? 'approved equivalent' : 'unapproved'})`,
      ),
    );
  }
  lines.push('Violations:');
  lines.push(
    ...(evaluation.violations.length === 0
      ? ['- none']
      : evaluation.violations.map((violation) => `- ${violation}`)),
  );
  return `${lines.join('\n')}\n`;
}
