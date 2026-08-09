import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, before, test } from 'node:test';

import {
  evaluateMutationReport,
  formatPolicySummary,
  mutantFingerprint,
  sha256Text,
  validateCriticalManifest,
  validateEquivalentAllowlist,
} from '../../scripts/quality/mutation-policy.mjs';

const SELECTED_SOURCES = [
  'src/auth/token-session.service.ts',
  'src/auth/auth-identifier-repair.service.ts',
  'src/auth/auth-identifier-reconciliation.service.ts',
  'src/members/members.service.ts',
  'src/borrowings/borrowings.service.ts',
];

const SOURCE =
  'line one\ncritical start\ncritical middle\ncritical end\nline five\nline six\n';
const SOURCE_SHA256 =
  'dfbb14b8cdf560c0ad5ed64ae0f0fae8793880c2abfcd38763c9c32be6f2d3cb';
const FIRST_RULE_FINGERPRINT =
  '04b269fc86fb3776a2f2c4f930609336afd7098516f7925d61d7d1338a3e1a46';
const LAST_RULE_FINGERPRINT =
  'ace30be0d737116114d5e96e76c5f4d8f07cb395c9fc40b09c64b2b7574d2089';
const TEST_CLOCK_MS = Date.now();
const VALID_REVIEWED_AT = new Date(
  TEST_CLOCK_MS - 24 * 60 * 60 * 1000,
).toISOString();
const VALID_EXPIRES_AT = new Date(
  TEST_CLOCK_MS + 30 * 24 * 60 * 60 * 1000,
).toISOString();
const REPOSITORY_ROOT = process.cwd();
const UPDATER_PATH = join(
  REPOSITORY_ROOT,
  'scripts',
  'quality',
  'update-critical-rule-manifest.mjs',
);

let temporaryRoot;
let sourceByPath;

before(() => {
  temporaryRoot = mkdtempSync(join(tmpdir(), 'mutation-policy-'));
  for (const source of SELECTED_SOURCES) {
    const target = join(temporaryRoot, ...source.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, SOURCE, 'utf8');
  }
  sourceByPath = new Map(
    SELECTED_SOURCES.map((source) => [
      source,
      readFileSync(join(temporaryRoot, ...source.split('/')), 'utf8'),
    ]),
  );
});

after(() => {
  rmSync(temporaryRoot, { recursive: true, force: true });
});

function makeManifest() {
  return {
    schemaVersion: 1,
    rules: SELECTED_SOURCES.map((source, index) => ({
      id: `critical-rule-${index + 1}`,
      invariant: `Critical invariant ${index + 1}`,
      source,
      sourceSha256: SOURCE_SHA256,
      startLine: 2,
      endLine: 4,
      startAnchor: 'critical start',
      endAnchor: 'critical end',
    })),
  };
}

function makeMutant(status = 'Killed', overrides = {}) {
  return {
    id: 'mutant-1',
    mutatorName: 'ConditionalExpression',
    replacement: 'false',
    status,
    location: {
      start: { line: 5, column: 1 },
      end: { line: 5, column: 6 },
    },
    ...overrides,
  };
}

function makeReport(mutantsBySource = {}) {
  return {
    schemaVersion: '2.0',
    thresholds: { high: 80, low: 70 },
    files: Object.fromEntries(
      SELECTED_SOURCES.map((source, index) => [
        source,
        {
          language: 'typescript',
          source: SOURCE,
          mutants: mutantsBySource[source] ?? [
            makeMutant('Killed', { id: `mutant-${index + 1}` }),
          ],
        },
      ]),
    ),
  };
}

function makeBaseline(rawCombinedScore = 70) {
  return {
    schemaVersion: 1,
    profile: 'complete',
    rawCombinedScore,
    generatedFromCommit: '0123456789abcdef0123456789abcdef01234567',
    generatedAt: '2026-08-08T00:00:00.000Z',
    selectedSources: [...SELECTED_SOURCES],
    sourceSha256: Object.fromEntries(
      SELECTED_SOURCES.map((source) => [source, SOURCE_SHA256]),
    ),
  };
}

function makeEquivalent(overrides = {}) {
  return {
    fingerprint: FIRST_RULE_FINGERPRINT,
    ruleId: 'critical-rule-1',
    sourceSha256: SOURCE_SHA256,
    proof: 'The replacement is observationally identical for every input.',
    reviewerModel: 'gpt-5.6-sol',
    reviewerReasoning: 'high',
    reviewedAt: VALID_REVIEWED_AT,
    expiresAt: VALID_EXPIRES_AT,
    ...overrides,
  };
}

function evaluate({
  profile = 'complete',
  report = makeReport(),
  manifest = makeManifest(),
  allowlist = { schemaVersion: 1, entries: [] },
  baseline = null,
} = {}) {
  return evaluateMutationReport({
    profile,
    report,
    manifest,
    allowlist,
    baseline,
  });
}

// Production break caught: hashing or canonical fingerprint fields drift.
test('hashes text and canonical mutant identity with hand-derived literals', () => {
  assert.equal(
    sha256Text('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
  assert.equal(
    mutantFingerprint(
      {
        source: 'src\\auth\\token-session.service.ts',
        mutatorName: 'ConditionalExpression',
        replacement: 'false',
        location: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 6 },
        },
      },
      SOURCE_SHA256,
    ),
    FIRST_RULE_FINGERPRINT,
  );
});

// Production break caught: the absolute 70.00 raw-score floor is skipped.
test('rejects a raw combined score below 70', () => {
  const report = makeReport(
    Object.fromEntries(
      SELECTED_SOURCES.map((source, index) => [
        source,
        [makeMutant(index === 0 ? 'Killed' : 'Survived', { id: `${index}` })],
      ]),
    ),
  );

  const evaluation = evaluate({ report });

  assert.equal(evaluation.rawCombinedScore, 20);
  assert.equal(evaluation.passed, false);
  assert.deepEqual(evaluation.violations, [
    'Raw combined mutation score 20.00 is below 70.00.',
  ]);
});

// Production break caught: complete runs are allowed to lower the tracked score.
test('rejects a score below the tracked upward-only baseline', () => {
  const report = makeReport({
    [SELECTED_SOURCES[0]]: [makeMutant('Survived', { id: 'survivor' })],
  });

  const evaluation = evaluate({ report, baseline: makeBaseline(90) });

  assert.equal(evaluation.rawCombinedScore, 80);
  assert.equal(evaluation.passed, false);
  assert.deepEqual(evaluation.violations, [
    'Complete raw mutation score 80.00 is below baseline 90.00.',
  ]);
});

// Production break caught: smoke accidentally enforces the complete-run baseline.
test('validates but does not compare smoke score with the complete baseline', () => {
  const report = makeReport({
    [SELECTED_SOURCES[0]]: [makeMutant('Survived', { id: 'survivor' })],
  });

  const evaluation = evaluate({
    profile: 'smoke',
    report,
    baseline: makeBaseline(90),
  });

  assert.equal(evaluation.rawCombinedScore, 80);
  assert.equal(evaluation.passed, true);
  assert.deepEqual(evaluation.violations, []);
});

// Production break caught: pre-Task-6 runs are rejected when no baseline exists yet.
test('accepts a null baseline for smoke and complete profiles', () => {
  for (const profile of ['smoke', 'complete']) {
    const evaluation = evaluate({ profile, baseline: null });

    assert.equal(evaluation.rawCombinedScore, 100);
    assert.equal(evaluation.passed, true);
  }
});

// Production break caught: a one-based last-line survivor escapes the inclusive rule.
test('rejects a surviving mutant overlapping a critical rule', () => {
  const report = makeReport({
    [SELECTED_SOURCES[0]]: [
      makeMutant('Survived', {
        location: {
          start: { line: 4, column: 1 },
          end: { line: 4, column: 6 },
        },
      }),
    ],
  });

  const evaluation = evaluate({ report });

  assert.equal(evaluation.passed, false);
  assert.deepEqual(evaluation.violations, [
    `Critical mutant ${LAST_RULE_FINGERPRINT} (Survived) is not an approved equivalent for critical-rule-1.`,
  ]);
  assert.equal(evaluation.criticalFindings[0].manifestLine, 4);
});

// Production break caught: a one-based first-line NoCoverage overlap is missed.
test('rejects a no-coverage mutant overlapping a critical rule', () => {
  const report = makeReport({
    [SELECTED_SOURCES[0]]: [
      makeMutant('NoCoverage', {
        location: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 6 },
        },
      }),
    ],
  });

  const evaluation = evaluate({ report });

  assert.equal(evaluation.passed, false);
  assert.equal(evaluation.criticalFindings[0].ruleId, 'critical-rule-1');
  assert.equal(evaluation.criticalFindings[0].manifestLine, 2);
  assert.equal(evaluation.criticalFindings[0].status, 'NoCoverage');
});

// Production break caught: a report location beyond the source line count is accepted.
test('rejects a report location beyond its source lines', () => {
  const report = makeReport({
    [SELECTED_SOURCES[0]]: [
      makeMutant('Killed', {
        location: {
          start: { line: 8, column: 1 },
          end: { line: 8, column: 2 },
        },
      }),
    ],
  });

  assert.throws(() => evaluate({ report }), /location line exceeds its source/);
});

// Production break caught: an out-of-source survivor outside critical lines is accepted.
test('rejects a report location beyond its source columns', () => {
  const report = makeReport({
    [SELECTED_SOURCES[0]]: [
      makeMutant('Survived', {
        location: {
          start: { line: 5, column: 11 },
          end: { line: 5, column: 12 },
        },
      }),
    ],
  });

  assert.throws(
    () => evaluate({ report }),
    /location column exceeds its source/,
  );
});

// Production break caught: a non-exact fingerprint, rule, or source hash bypasses review.
test('accepts only an exact equivalent fingerprint tied to source SHA and rule id', () => {
  const report = makeReport({
    [SELECTED_SOURCES[0]]: [
      makeMutant('Survived', {
        location: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 6 },
        },
      }),
    ],
  });
  const allowlist = { schemaVersion: 1, entries: [makeEquivalent()] };

  const evaluation = evaluate({ report, allowlist });

  assert.equal(evaluation.passed, true);
  assert.equal(evaluation.rawCombinedScore, 80);
  assert.equal(evaluation.criticalFindings[0].equivalent, true);

  for (const entry of [
    makeEquivalent({ fingerprint: 'a'.repeat(64) }),
    makeEquivalent({ ruleId: 'critical-rule-2' }),
  ]) {
    const rejected = evaluate({
      report,
      allowlist: { schemaVersion: 1, entries: [entry] },
    });
    assert.equal(rejected.passed, false);
  }
});

// Production break caught: stale, expired, or wildcard review records remain trusted.
test('rejects stale source SHA, expired equivalent entries, and wildcard entries', async (t) => {
  await t.test('stale manifest hash', () => {
    const manifest = makeManifest();
    manifest.rules[0].sourceSha256 = 'a'.repeat(64);
    assert.throws(
      () => validateCriticalManifest(manifest, sourceByPath),
      /stale sourceSha256/,
    );
  });

  await t.test('stale allowlist hash', () => {
    assert.throws(
      () =>
        validateEquivalentAllowlist(
          {
            schemaVersion: 1,
            entries: [makeEquivalent({ sourceSha256: 'a'.repeat(64) })],
          },
          makeManifest(),
          '2026-08-09T00:00:00.000Z',
        ),
      /sourceSha256 does not match/,
    );
  });

  await t.test('expired entry', () => {
    assert.throws(
      () =>
        validateEquivalentAllowlist(
          {
            schemaVersion: 1,
            entries: [
              makeEquivalent({
                reviewedAt: '2026-05-01T00:00:00.000Z',
                expiresAt: '2026-07-01T00:00:00.000Z',
              }),
            ],
          },
          makeManifest(),
          '2026-08-09T00:00:00.000Z',
        ),
      /expired/,
    );
  });

  await t.test('wildcard entry', () => {
    assert.throws(
      () =>
        validateEquivalentAllowlist(
          {
            schemaVersion: 1,
            entries: [makeEquivalent({ ruleId: '*' })],
          },
          makeManifest(),
          '2026-08-09T00:00:00.000Z',
        ),
      /wildcard/,
    );
  });
});

// Production break caught: missing, extra, or non-normalized production paths pass scope review.
test('rejects reports whose mutated file set is not exactly the five selected files', async (t) => {
  await t.test('missing file', () => {
    const report = makeReport();
    delete report.files[SELECTED_SOURCES[4]];
    assert.throws(
      () => evaluate({ report }),
      /exactly the five selected files/,
    );
  });

  await t.test('extra file', () => {
    const report = makeReport();
    report.files['src/extra.service.ts'] = {
      language: 'typescript',
      source: SOURCE,
      mutants: [],
    };
    assert.throws(
      () => evaluate({ report }),
      /exactly the five selected files/,
    );
  });

  await t.test('backslash path', () => {
    const report = makeReport();
    const value = report.files[SELECTED_SOURCES[0]];
    delete report.files[SELECTED_SOURCES[0]];
    report.files['src\\auth\\token-session.service.ts'] = value;
    assert.throws(() => evaluate({ report }), /must use forward slashes/);
  });
});

// Production break caught: summaries omit modules/findings or equivalents inflate raw score.
test('writes module scores and critical findings without changing the raw score', () => {
  const report = makeReport({
    [SELECTED_SOURCES[0]]: [
      makeMutant('Survived', {
        location: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 6 },
        },
      }),
    ],
  });
  const evaluation = evaluate({
    report,
    allowlist: { schemaVersion: 1, entries: [makeEquivalent()] },
  });

  assert.equal(evaluation.rawCombinedScore, 80);
  assert.deepEqual(
    evaluation.moduleScores.map(({ source, rawScore }) => ({
      source,
      rawScore,
    })),
    [
      { source: SELECTED_SOURCES[0], rawScore: 0 },
      { source: SELECTED_SOURCES[1], rawScore: 100 },
      { source: SELECTED_SOURCES[2], rawScore: 100 },
      { source: SELECTED_SOURCES[3], rawScore: 100 },
      { source: SELECTED_SOURCES[4], rawScore: 100 },
    ],
  );
  assert.match(formatPolicySummary(evaluation), /Raw combined score: 80\.00%/);
  assert.match(
    formatPolicySummary(evaluation),
    /src\/auth\/token-session\.service\.ts: 0\.00%/,
  );
  assert.match(
    formatPolicySummary(evaluation),
    /critical-rule-1.*Survived.*approved equivalent/,
  );
});

// Production break caught: detected/undetected/ignored status accounting drifts.
test('uses Stryker raw status semantics and excludes ignored mutants', () => {
  const report = makeReport({
    [SELECTED_SOURCES[0]]: [
      makeMutant('Killed', { id: 'killed' }),
      makeMutant('Timeout', { id: 'timeout' }),
      makeMutant('CompileError', { id: 'compile' }),
      makeMutant('RuntimeError', { id: 'runtime' }),
      makeMutant('Survived', { id: 'survived' }),
      makeMutant('NoCoverage', { id: 'no-coverage' }),
      makeMutant('Ignored', { id: 'ignored' }),
    ],
  });

  const evaluation = evaluate({ report });

  assert.equal(evaluation.detected, 8);
  assert.equal(evaluation.undetected, 2);
  assert.equal(evaluation.ignored, 1);
  assert.equal(evaluation.rawCombinedScore, 80);
});

// Production break caught: zero score denominator is treated as failure or NaN.
test('returns raw score 100 for empty and ignored-only reports', async (t) => {
  await t.test('empty mutants', () => {
    const report = makeReport(
      Object.fromEntries(SELECTED_SOURCES.map((source) => [source, []])),
    );

    const evaluation = evaluate({ report });

    assert.equal(evaluation.rawCombinedScore, 100);
    assert.equal(evaluation.detected, 0);
    assert.equal(evaluation.undetected, 0);
    assert.equal(evaluation.ignored, 0);
    assert.equal(evaluation.passed, true);
  });

  await t.test('ignored-only mutants', () => {
    const report = makeReport(
      Object.fromEntries(
        SELECTED_SOURCES.map((source, index) => [
          source,
          [makeMutant('Ignored', { id: `ignored-${index + 1}` })],
        ]),
      ),
    );

    const evaluation = evaluate({ report });

    assert.equal(evaluation.rawCombinedScore, 100);
    assert.equal(evaluation.detected, 0);
    assert.equal(evaluation.undetected, 0);
    assert.equal(evaluation.ignored, 5);
    assert.equal(evaluation.passed, true);
  });
});

// Production break caught: malformed schema components are coerced or ignored.
test('fails closed on malformed schema, status, profile, paths, hashes, ranges, allowlist, and baseline', async (t) => {
  await t.test('manifest schema', () => {
    assert.throws(
      () =>
        validateCriticalManifest({ schemaVersion: 2, rules: [] }, sourceByPath),
      /schemaVersion/,
    );
  });

  await t.test('unknown and pending statuses', () => {
    for (const status of ['Unknown', 'Pending']) {
      const report = makeReport({
        [SELECTED_SOURCES[0]]: [makeMutant(status)],
      });
      assert.throws(() => evaluate({ report }), /status/);
    }
  });

  await t.test('profile', () => {
    assert.throws(() => evaluate({ profile: 'preview' }), /profile/);
  });

  await t.test('manifest path', () => {
    const manifest = makeManifest();
    manifest.rules[0].source = 'src\\auth\\token-session.service.ts';
    assert.throws(
      () => validateCriticalManifest(manifest, sourceByPath),
      /forward slashes/,
    );
  });

  await t.test('hash', () => {
    const manifest = makeManifest();
    manifest.rules[0].sourceSha256 = 'ABC';
    assert.throws(
      () => validateCriticalManifest(manifest, sourceByPath),
      /64-character lowercase/,
    );
  });

  await t.test('range', () => {
    const manifest = makeManifest();
    manifest.rules[0].startLine = 0;
    assert.throws(
      () => validateCriticalManifest(manifest, sourceByPath),
      /positive integer/,
    );
  });

  await t.test('allowlist cardinality', () => {
    assert.throws(
      () =>
        validateEquivalentAllowlist(
          {
            schemaVersion: 1,
            entries: [
              {
                ...makeEquivalent(),
                ruleId: undefined,
                ruleIds: ['critical-rule-1'],
              },
            ],
          },
          makeManifest(),
          '2026-08-09T00:00:00.000Z',
        ),
      /exact fields|ruleId/,
    );
  });

  await t.test('baseline', () => {
    const baseline = makeBaseline(80);
    baseline.generatedFromCommit = 'not-a-commit';
    assert.throws(
      () => evaluate({ profile: 'smoke', baseline }),
      /generatedFromCommit/,
    );
  });

  await t.test('report location', () => {
    const report = makeReport({
      [SELECTED_SOURCES[0]]: [
        makeMutant('Killed', {
          location: {
            start: { line: -1, column: 0 },
            end: { line: 0, column: 0 },
          },
        }),
      ],
    });
    assert.throws(() => evaluate({ report }), /location/);
  });

  await t.test('ordered report location', () => {
    const report = makeReport({
      [SELECTED_SOURCES[0]]: [
        makeMutant('Killed', {
          location: {
            start: { line: 5, column: 6 },
            end: { line: 5, column: 1 },
          },
        }),
      ],
    });
    assert.throws(() => evaluate({ report }), /exclusive end after its start/);
  });
});

// Production break caught: a valid manifest is not verified against real source bytes and anchors.
test('validates manifest against temporary source files', () => {
  assert.deepEqual(
    validateCriticalManifest(makeManifest(), sourceByPath),
    makeManifest(),
  );
});

function updaterResult(repositoryRoot, mode) {
  return spawnSync(process.execPath, [UPDATER_PATH, mode], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
}

function writeUpdaterFixture() {
  const root = mkdtempSync(join(tmpdir(), 'mutation-manifest-updater-'));
  const manifest = makeManifest();
  for (const source of SELECTED_SOURCES) {
    const target = join(root, ...source.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, SOURCE, 'utf8');
  }
  const qualityDirectory = join(root, 'test', 'quality');
  mkdirSync(qualityDirectory, { recursive: true });
  writeFileSync(
    join(qualityDirectory, 'critical-rule-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(
    join(qualityDirectory, 'mutation-equivalents.json'),
    '{\n  "schemaVersion": 1,\n  "entries": []\n}\n',
    'utf8',
  );
  return { root, manifest };
}

// Production break caught: the tracked manifest or allowlist is absent or stale.
test('checks the tracked critical-rule manifest and strict empty allowlist', () => {
  const result = updaterResult(REPOSITORY_ROOT, '--check');

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const manifest = JSON.parse(
    readFileSync(
      join(REPOSITORY_ROOT, 'test', 'quality', 'critical-rule-manifest.json'),
      'utf8',
    ),
  );
  const allowlist = JSON.parse(
    readFileSync(
      join(REPOSITORY_ROOT, 'test', 'quality', 'mutation-equivalents.json'),
      'utf8',
    ),
  );
  const realSources = new Map(
    SELECTED_SOURCES.map((source) => [
      source,
      readFileSync(join(REPOSITORY_ROOT, ...source.split('/')), 'utf8'),
    ]),
  );

  assert.deepEqual(validateCriticalManifest(manifest, realSources), manifest);
  assert.deepEqual(
    validateEquivalentAllowlist(allowlist, manifest, new Date().toISOString()),
    { schemaVersion: 1, entries: [] },
  );
  assert.deepEqual(
    [...new Set(manifest.rules.map((rule) => rule.source))],
    SELECTED_SOURCES,
  );
});

// Production break caught: check mode accepts stale bytes or unresolved anchors.
test('check mode rejects stale SHA and missing or ambiguous anchors', async (t) => {
  await t.test('stale source SHA', () => {
    const fixture = writeUpdaterFixture();
    try {
      writeFileSync(
        join(fixture.root, ...SELECTED_SOURCES[0].split('/')),
        `${SOURCE}source edit\n`,
        'utf8',
      );

      const result = updaterResult(fixture.root, '--check');

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /stale sourceSha256/);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  await t.test('missing anchor', () => {
    const fixture = writeUpdaterFixture();
    try {
      fixture.manifest.rules[0].startAnchor = 'missing critical anchor';
      writeFileSync(
        join(fixture.root, 'test', 'quality', 'critical-rule-manifest.json'),
        `${JSON.stringify(fixture.manifest, null, 2)}\n`,
        'utf8',
      );

      const result = updaterResult(fixture.root, '--check');

      assert.notEqual(result.status, 0);
      assert.match(
        result.stderr,
        /startAnchor does not match|anchor.*missing/i,
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  await t.test('ambiguous anchor', () => {
    const fixture = writeUpdaterFixture();
    try {
      const source = SOURCE.replace('line five', 'critical start\nline five');
      writeFileSync(
        join(fixture.root, ...SELECTED_SOURCES[0].split('/')),
        source,
        'utf8',
      );
      fixture.manifest.rules[0].sourceSha256 = sha256Text(source);
      writeFileSync(
        join(fixture.root, 'test', 'quality', 'critical-rule-manifest.json'),
        `${JSON.stringify(fixture.manifest, null, 2)}\n`,
        'utf8',
      );

      const result = updaterResult(fixture.root, '--check');

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /startAnchor is not unique/);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

// Production break caught: candidate mode rewrites reviewed JSON or writes outside reports.
test('candidate mode writes only a refreshed review candidate below reports', () => {
  const fixture = writeUpdaterFixture();
  try {
    const trackedPath = join(
      fixture.root,
      'test',
      'quality',
      'critical-rule-manifest.json',
    );
    const trackedBefore = readFileSync(trackedPath, 'utf8');
    const editedSource = `inserted line\n${SOURCE}`;
    writeFileSync(
      join(fixture.root, ...SELECTED_SOURCES[0].split('/')),
      editedSource,
      'utf8',
    );

    const result = updaterResult(fixture.root, '--candidate');

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(readFileSync(trackedPath, 'utf8'), trackedBefore);
    const candidatePath = join(
      fixture.root,
      'reports',
      'mutation',
      'critical-rule-manifest.candidate.json',
    );
    const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'));
    assert.equal(candidate.rules[0].sourceSha256, sha256Text(editedSource));
    assert.equal(candidate.rules[0].startLine, 3);
    assert.equal(candidate.rules[0].endLine, 5);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

// Production break caught: manifest rules no longer have exact narrow inclusive identity.
test('requires complete ordered rule identity and invalidates a source edit', () => {
  const manifest = makeManifest();
  const validated = validateCriticalManifest(manifest, sourceByPath);

  for (const rule of validated.rules) {
    assert.equal(typeof rule.id, 'string');
    assert.equal(typeof rule.invariant, 'string');
    assert.match(rule.sourceSha256, /^[0-9a-f]{64}$/);
    assert.ok(Number.isInteger(rule.startLine) && rule.startLine > 0);
    assert.ok(Number.isInteger(rule.endLine) && rule.endLine >= rule.startLine);
    assert.equal(typeof rule.startAnchor, 'string');
    assert.equal(typeof rule.endAnchor, 'string');
  }

  const editedSources = new Map(sourceByPath);
  editedSources.set(SELECTED_SOURCES[0], `${SOURCE}source edit\n`);
  assert.throws(
    () => validateCriticalManifest(manifest, editedSources),
    /stale sourceSha256/,
  );
});

// Production break caught: a Plan 3-reviewed security or state invariant is left
// to the aggregate mutation score instead of the zero-survivor critical gate.
test('covers every Plan 3-reviewed critical invariant occurrence with a manifest rule', () => {
  const reviewedOccurrences = [
    // Refresh denial, replay, revocation, and revoked/expired-family handling.
    [
      'src/auth/token-session.service.ts',
      132,
      'revoked/expired token rejection',
    ],
    ['src/auth/token-session.service.ts', 163, 'replay/revocation'],
    ['src/auth/token-session.service.ts', 191, 'replay/revocation'],
    ['src/auth/token-session.service.ts', 197, 'replay/revocation'],
    [
      'src/auth/token-session.service.ts',
      249,
      'revoked/expired token rejection',
    ],
    ['src/auth/token-session.service.ts', 275, 'replay/revocation'],
    ['src/auth/token-session.service.ts', 292, 'replay/revocation'],
    ['src/auth/token-session.service.ts', 299, 'replay/revocation'],
    ['src/auth/token-session.service.ts', 356, 'replay/revocation'],
    [
      'src/auth/token-session.service.ts',
      368,
      'revoked/expired token rejection',
    ],
    ['src/auth/token-session.service.ts', 383, 'replay/revocation'],
    [
      'src/auth/token-session.service.ts',
      391,
      'revoked/expired token rejection',
    ],
    ['src/auth/token-session.service.ts', 401, 'replay/revocation'],
    ['src/auth/token-session.service.ts', 410, 'replay/revocation'],
    [
      'src/auth/token-session.service.ts',
      425,
      'revoked/expired token rejection',
    ],
    [
      'src/auth/token-session.service.ts',
      435,
      'revoked/expired token rejection',
    ],
    [
      'src/auth/token-session.service.ts',
      445,
      'revoked/expired token rejection',
    ],
    ['src/auth/token-session.service.ts', 468, 'replay/revocation'],
    ['src/auth/token-session.service.ts', 475, 'replay/revocation'],
    ['src/auth/token-session.service.ts', 497, 'replay/revocation'],
    ['src/auth/token-session.service.ts', 503, 'replay/revocation'],
    ['src/auth/token-session.service.ts', 513, 'replay/revocation'],
    ['src/auth/token-session.service.ts', 536, 'replay/revocation'],
    ['src/auth/token-session.service.ts', 546, 'replay/revocation'],

    // Offline-repair authorization, claimant ownership, and terminal ordering.
    [
      'src/auth/auth-identifier-repair.service.ts',
      93,
      'authorization/role denial',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      134,
      'authorization/role denial',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      149,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      168,
      'authorization/role denial',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      202,
      'authorization/role denial',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      265,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      305,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      329,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      353,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      369,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      377,
      'authorization/role denial',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      386,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      401,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      417,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      425,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      456,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      461,
      'terminal event/cleanup/TTL ordering',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      476,
      'terminal event/cleanup/TTL ordering',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      503,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      519,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      530,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      564,
      'terminal event/cleanup/TTL ordering',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      610,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      616,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      657,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      684,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      706,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      714,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      738,
      'authorization/role denial',
    ],
    [
      'src/auth/auth-identifier-repair.service.ts',
      788,
      'authorization/role denial',
    ],

    // Reconciliation lease ownership, recovery ownership, and terminal cleanup.
    [
      'src/auth/auth-identifier-reconciliation.service.ts',
      179,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-reconciliation.service.ts',
      222,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-reconciliation.service.ts',
      267,
      'terminal event/cleanup/TTL ordering',
    ],
    [
      'src/auth/auth-identifier-reconciliation.service.ts',
      304,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-reconciliation.service.ts',
      360,
      'terminal event/cleanup/TTL ordering',
    ],
    [
      'src/auth/auth-identifier-reconciliation.service.ts',
      444,
      'terminal event/cleanup/TTL ordering',
    ],
    [
      'src/auth/auth-identifier-reconciliation.service.ts',
      495,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-reconciliation.service.ts',
      551,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-reconciliation.service.ts',
      596,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-reconciliation.service.ts',
      654,
      'terminal event/cleanup/TTL ordering',
    ],
    [
      'src/auth/auth-identifier-reconciliation.service.ts',
      721,
      'terminal event/cleanup/TTL ordering',
    ],
    [
      'src/auth/auth-identifier-reconciliation.service.ts',
      805,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-reconciliation.service.ts',
      820,
      'member/staff ownership',
    ],
    [
      'src/auth/auth-identifier-reconciliation.service.ts',
      834,
      'member/staff ownership',
    ],

    // Member identifier ownership, lifecycle revocation, and denial boundaries.
    ['src/members/members.service.ts', 164, 'member/staff ownership'],
    ['src/members/members.service.ts', 176, 'member/staff ownership'],
    ['src/members/members.service.ts', 204, 'replay/revocation'],
    ['src/members/members.service.ts', 219, 'replay/revocation'],
    ['src/members/members.service.ts', 284, 'authorization/role denial'],
    ['src/members/members.service.ts', 304, 'member/staff ownership'],
    ['src/members/members.service.ts', 328, 'member/staff ownership'],
    ['src/members/members.service.ts', 345, 'replay/revocation'],
    ['src/members/members.service.ts', 410, 'member/staff ownership'],
    ['src/members/members.service.ts', 446, 'member/staff ownership'],
    ['src/members/members.service.ts', 469, 'member/staff ownership'],
    ['src/members/members.service.ts', 492, 'replay/revocation'],

    // Borrowing authorization, ownership, policy, and state transitions/effects.
    ['src/borrowings/borrowings.service.ts', 54, 'authorization/role denial'],
    [
      'src/borrowings/borrowings.service.ts',
      78,
      'illegal borrowing transitions',
    ],
    [
      'src/borrowings/borrowings.service.ts',
      96,
      'illegal borrowing transitions',
    ],
    ['src/borrowings/borrowings.service.ts', 108, 'authorization/role denial'],
    [
      'src/borrowings/borrowings.service.ts',
      119,
      'illegal borrowing transitions',
    ],
    [
      'src/borrowings/borrowings.service.ts',
      125,
      'illegal borrowing transitions',
    ],
    [
      'src/borrowings/borrowings.service.ts',
      138,
      'illegal borrowing transitions',
    ],
    ['src/borrowings/borrowings.service.ts', 185, 'member/staff ownership'],
    ['src/borrowings/borrowings.service.ts', 211, 'member/staff ownership'],
    [
      'src/borrowings/borrowings.service.ts',
      228,
      'illegal borrowing transitions',
    ],
    [
      'src/borrowings/borrowings.service.ts',
      262,
      'illegal borrowing transitions',
    ],
    ['src/borrowings/borrowings.service.ts', 359, 'authorization/role denial'],
    ['src/borrowings/borrowings.service.ts', 375, 'authorization/role denial'],
  ];
  const manifest = JSON.parse(
    readFileSync(
      join(REPOSITORY_ROOT, 'test', 'quality', 'critical-rule-manifest.json'),
      'utf8',
    ),
  );
  assert.deepEqual(
    [...new Set(reviewedOccurrences.map(([source]) => source))],
    SELECTED_SOURCES,
  );
  assert.deepEqual(
    [...new Set(reviewedOccurrences.map(([, , category]) => category))].sort(),
    [
      'authorization/role denial',
      'illegal borrowing transitions',
      'member/staff ownership',
      'replay/revocation',
      'revoked/expired token rejection',
      'terminal event/cleanup/TTL ordering',
    ],
  );
  assert.equal(
    new Set(reviewedOccurrences.map(([source, line]) => `${source}:${line}`))
      .size,
    reviewedOccurrences.length,
  );
  const uncovered = reviewedOccurrences.filter(
    ([source, line]) =>
      !manifest.rules.some(
        (rule) =>
          rule.source === source &&
          rule.startLine <= line &&
          rule.endLine >= line,
      ),
  );

  assert.deepEqual(uncovered, []);
});
