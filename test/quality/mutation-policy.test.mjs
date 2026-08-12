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

// Production break caught: a pre-baseline smoke artifact with the exact selected
// source bytes cannot pass through the tracked manifest and empty allowlist.
test('evaluates an exact tracked pre-baseline smoke artifact', () => {
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
  const report = {
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
          mutants: [],
        },
      ]),
    ),
  };

  const evaluation = evaluateMutationReport({
    profile: 'smoke',
    report,
    manifest,
    allowlist,
    baseline: null,
  });

  assert.equal(evaluation.passed, true);
  assert.equal(evaluation.rawCombinedScore, 100);
  assert.deepEqual(evaluation.criticalFindings, []);
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
test('keeps the Fix Round 1 point inventory as a lower-bound overlap smoke', () => {
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

// Production break caught: reviewed executable helper/branch bodies are absent
// from the critical gate or are covered only by a differently classified rule.
test('protects every named Plan 3 executable line with same-category manifest rules', () => {
  const AUTHORIZATION = 'authorization/role denial';
  const OWNERSHIP = 'member/staff ownership';
  const REPLAY = 'replay/revocation';
  const TOKEN_REJECTION = 'revoked/expired token rejection';
  const BORROWING_STATE = 'illegal borrowing transitions';
  const TERMINAL_ORDERING = 'terminal event/cleanup/TTL ordering';
  const categories = [
    AUTHORIZATION,
    OWNERSHIP,
    REPLAY,
    TOKEN_REJECTION,
    BORROWING_STATE,
    TERMINAL_ORDERING,
  ];
  const plan3Root = join(
    REPOSITORY_ROOT,
    '.superpowers',
    'sdd',
    '2026-07-29-plan-3-critical-module-branch-hardening',
  );
  const item = (id, startLine, endLine, itemCategories, tests) => ({
    id,
    startLine,
    endLine,
    categories: itemCategories,
    tests,
  });
  const groups = [
    {
      source: 'src/auth/token-session.service.ts',
      spec: 'src/auth/token-session.service.spec.ts',
      evidence: ['task-01-review.md'],
      items: [
        item(
          'token-empty-refresh-denial',
          132,
          133,
          [TOKEN_REJECTION],
          [
            'rejects malformed, missing, expired, and revoked credentials without mutation',
          ],
        ),
        item(
          'token-family-cas-and-interruption',
          136,
          168,
          [REPLAY],
          [
            'commits a hash-only marker after operation-correlated family CAS',
            'leaves an uncertain family CAS pending and takeover-eligible',
          ],
        ),
        item(
          'token-rotation-failure-denial',
          171,
          198,
          [REPLAY],
          [
            'fails closed when marker commitment is interrupted after family CAS',
            'fails closed when a completed rotation marker cannot be found',
          ],
        ),
        item(
          'token-family-resolution',
          207,
          228,
          [REPLAY],
          [
            'resolves only a family id for active and replayed refresh credentials',
          ],
        ),
        item(
          'token-expired-marker-reconciliation',
          232,
          272,
          [REPLAY, TOKEN_REJECTION],
          [
            'reconciles orphaned rotations and leaves expired pre-CAS work for takeover',
          ],
        ),
        item(
          'token-refresh-revocation-selector',
          279,
          289,
          [REPLAY],
          ['revokes families and subjects idempotently'],
        ),
        item(
          'token-family-revocation-selector',
          293,
          296,
          [REPLAY],
          ['revokes families and subjects idempotently'],
        ),
        item(
          'token-subject-revocation-selector',
          304,
          307,
          [REPLAY],
          [
            'revokes current and all subject sessions without exposing token hashes',
          ],
        ),
        item(
          'token-marker-preparation',
          352,
          394,
          [REPLAY, TOKEN_REJECTION],
          [
            'denies a lost duplicate-marker race without mutating the family',
            'rejects malformed, missing, expired, and revoked credentials without mutation',
          ],
        ),
        item(
          'token-committed-marker-replay',
          401,
          417,
          [REPLAY],
          ['revokes on replay from any committed generation'],
        ),
        item(
          'token-pending-marker-takeover',
          420,
          470,
          [REPLAY, TOKEN_REJECTION],
          [
            'denies an active pending lease without mutating the family',
            'takes over an expired pre-CAS lease and rotates once',
            'denies a lost expired-marker takeover without creating a successor',
          ],
        ),
        item(
          'token-interrupted-cas-recovery',
          480,
          497,
          [REPLAY],
          [
            'finalizes an uncertain family CAS that installed a successor',
            'leaves an uncertain family CAS pending and takeover-eligible',
          ],
        ),
        item(
          'token-finalize-before-revoke',
          509,
          510,
          [REPLAY],
          [
            'reconciles orphaned rotations and leaves expired pre-CAS work for takeover',
          ],
        ),
        item(
          'token-marker-commit-cas',
          517,
          533,
          [REPLAY],
          ['commits a hash-only marker after operation-correlated family CAS'],
        ),
        item(
          'token-replay-family-revocation',
          537,
          543,
          [REPLAY],
          ['revokes on replay from any committed generation'],
        ),
        item(
          'token-hash-clearing-revocation-update',
          547,
          554,
          [REPLAY],
          [
            'revokes current and all subject sessions without exposing token hashes',
          ],
        ),
        item(
          'token-duplicate-key-classification',
          578,
          583,
          [REPLAY],
          ['denies a lost duplicate-marker race without mutating the family'],
        ),
        item(
          'token-generic-refresh-denial',
          587,
          587,
          [AUTHORIZATION, TOKEN_REJECTION],
          [
            'rejects malformed, missing, expired, and revoked credentials without mutation',
          ],
        ),
      ],
    },
    {
      source: 'src/auth/auth-identifier-repair.service.ts',
      spec: 'src/auth/auth-identifier-repair.service.spec.ts',
      evidence: ['task-02-review.md', 'task-03-review.md'],
      items: [
        item(
          'repair-dry-run-authorization-and-claimants',
          94,
          131,
          [AUTHORIZATION, OWNERSHIP],
          [
            'dry-runs an existing matching operation without mutating any model',
            'rejects an unavailable manifest key before looking up an operation',
          ],
        ),
        item(
          'repair-apply-authorization-and-resume',
          135,
          165,
          [AUTHORIZATION, OWNERSHIP],
          [
            'fails closed when a resume manifest differs from the persisted hash',
            'replays a completed operation without preparing or activating batches',
          ],
        ),
        item(
          'repair-apply-reauthorization-and-transition',
          168,
          195,
          [AUTHORIZATION, TERMINAL_ORDERING],
          [
            'uses bounded unique batches, reauthorizes each mutation boundary, and completes atomically',
            'fails closed before parent completion when authorization expires',
          ],
        ),
        item(
          'repair-cancel-authorization-and-transition',
          203,
          259,
          [AUTHORIZATION, TERMINAL_ORDERING],
          [
            'leaves cancellation retryable when authorization expires between compensation batches',
            'revalidates authorization after the final compensation batch before parent mutations',
          ],
        ),
        item(
          'repair-batch-identity-and-checkpoint',
          272,
          304,
          [OWNERSHIP],
          [
            'prepares a new bounded batch before applying its aggregate changes',
            'rejects a mismatched pending batch checkpoint before aggregate mutation and ends the session',
          ],
        ),
        item(
          'repair-batch-transactional-ownership',
          305,
          365,
          [OWNERSHIP, TERMINAL_ORDERING],
          [
            'prepares a new bounded batch before applying its aggregate changes',
            'fails before repair writes when MongoDB transaction support is absent',
          ],
        ),
        item(
          'repair-batch-activation-gate',
          370,
          414,
          [OWNERSHIP, TERMINAL_ORDERING],
          [
            'activates a prepared batch and keeps its identifiers gated until parent completion',
            'does not activate missing or already activated batches',
          ],
        ),
        item(
          'repair-parent-conflict-ownership',
          422,
          460,
          [OWNERSHIP],
          [
            'releases the original conflict under the first reassigned subject and records the terminal event first',
          ],
        ),
        item(
          'repair-completed-event-order',
          461,
          499,
          [TERMINAL_ORDERING],
          ['completes the parent only after recording its terminal event'],
        ),
        item(
          'repair-reverse-compensation',
          507,
          562,
          [OWNERSHIP, TERMINAL_ORDERING],
          [
            'compensates batch assignments in reverse and releases their reservations',
            'skips non-releasable cancellation assignments and still records a redacted failed terminal event first',
          ],
        ),
        item(
          'repair-failed-event-order',
          565,
          608,
          [TERMINAL_ORDERING],
          ['records a cancellation terminal event before failing its parent'],
        ),
        item(
          'repair-replacement-ownership',
          616,
          655,
          [OWNERSHIP],
          [
            'reserves a replacement with pending ownership for the repair operation',
            'maps duplicate replacement writes to the fixed reservation conflict',
          ],
        ),
        item(
          'repair-aggregate-field-ownership',
          662,
          679,
          [OWNERSHIP],
          [
            'updates staff email and member loginIdentifier while incrementing authVersion once',
          ],
        ),
        item(
          'repair-aggregate-restoration',
          691,
          703,
          [OWNERSHIP],
          [
            'compensates batch assignments in reverse and releases their reservations',
          ],
        ),
        item(
          'repair-conflict-state-requirement',
          707,
          711,
          [AUTHORIZATION, OWNERSHIP],
          [
            'releases the original conflict under the first reassigned subject and records the terminal event first',
          ],
        ),
        item(
          'repair-exact-claimant-set',
          716,
          733,
          [OWNERSHIP],
          [
            'fails closed when a resume manifest differs from the persisted hash',
          ],
        ),
        item(
          'repair-persisted-manifest-authorization',
          740,
          759,
          [AUTHORIZATION, OWNERSHIP],
          [
            'fails closed when a resume manifest differs from the persisted hash',
          ],
        ),
        item(
          'repair-key-availability',
          763,
          768,
          [AUTHORIZATION],
          [
            'rejects a missing current key version before operation lookup or creation',
            'rejects an unavailable manifest key before looking up an operation',
          ],
        ),
        item(
          'repair-operation-requirement',
          774,
          776,
          [AUTHORIZATION],
          [
            'replays a completed operation without preparing or activating batches',
          ],
        ),
        item(
          'repair-transaction-support-requirement',
          780,
          785,
          [AUTHORIZATION, TERMINAL_ORDERING],
          [
            'fails before repair writes when MongoDB transaction support is absent',
          ],
        ),
        item(
          'repair-resume-actor-binding',
          793,
          804,
          [AUTHORIZATION, OWNERSHIP],
          [
            'uses bounded unique batches, reauthorizes each mutation boundary, and completes atomically',
          ],
        ),
        item(
          'repair-bounded-partition',
          810,
          820,
          [OWNERSHIP],
          [
            'uses bounded unique batches, reauthorizes each mutation boundary, and completes atomically',
          ],
        ),
        item(
          'repair-subject-key',
          843,
          843,
          [OWNERSHIP],
          [
            'updates staff email and member loginIdentifier while incrementing authVersion once',
          ],
        ),
        item(
          'repair-terminal-status-classification',
          847,
          850,
          [TERMINAL_ORDERING],
          [
            'replays a completed operation without preparing or activating batches',
            'replays terminal cancellation without compensation mutations',
          ],
        ),
        item(
          'repair-current-key-version',
          854,
          858,
          [AUTHORIZATION],
          [
            'rejects a missing current key version before operation lookup or creation',
          ],
        ),
        item(
          'repair-assignment-bound',
          862,
          865,
          [OWNERSHIP],
          [
            'uses bounded unique batches, reauthorizes each mutation boundary, and completes atomically',
          ],
        ),
      ],
    },
    {
      source: 'src/auth/auth-identifier-reconciliation.service.ts',
      spec: 'src/auth/auth-identifier-reconciliation.service.spec.ts',
      evidence: ['task-04-review.md', 'task-05-review.md'],
      items: [
        item(
          'reconciliation-owned-lease-renewal',
          180,
          202,
          [OWNERSHIP, TERMINAL_ORDERING],
          [
            'uses MongoDB time for atomic lease acquisition and renewal',
            'reports lost lease ownership without changing operation state',
          ],
        ),
        item(
          'reconciliation-bounded-claim-pass',
          223,
          264,
          [OWNERSHIP, TERMINAL_ORDERING],
          [
            'caps claims at the configured batch size and releases every acquired lease',
            'continues processing later claimed operations after one operation fails',
          ],
        ),
        item(
          'reconciliation-candidate-filter',
          268,
          286,
          [TERMINAL_ORDERING],
          [
            'processes claimed terminal cleanup and releases its lease through the public pass',
          ],
        ),
        item(
          'reconciliation-repair-key-availability',
          295,
          301,
          [AUTHORIZATION],
          [
            'skips an offline repair with unavailable audit material before claiming it',
          ],
        ),
        item(
          'reconciliation-exact-claim',
          307,
          357,
          [OWNERSHIP, TERMINAL_ORDERING],
          [
            'counts a lost claim as examined without claiming or processing it',
            'caps claims at the configured batch size and releases every acquired lease',
          ],
        ),
        item(
          'reconciliation-state-dispatch',
          363,
          405,
          [TERMINAL_ORDERING],
          [
            'moves a recoverable failed operation through a valid retry transition',
            'fails an invalid transition terminally with a redacted event',
          ],
        ),
        item(
          'reconciliation-invalid-terminal-order',
          447,
          493,
          [TERMINAL_ORDERING],
          [
            'fails an invalid transition terminally with a redacted event',
            'persists the idempotent terminal event before writing terminal TTL state',
          ],
        ),
        item(
          'reconciliation-reservation-attachment',
          498,
          549,
          [OWNERSHIP],
          [
            'attaches an HMAC-only reservation reference under the requested key version',
            'ignores an unmatched discovered reservation without mutating assignments',
          ],
        ),
        item(
          'reconciliation-application-recovery',
          554,
          594,
          [OWNERSHIP, TERMINAL_ORDERING],
          [
            'recovers applied reservations into finalization when every assignment is durable',
            'returns incomplete application recovery to a retryable state',
          ],
        ),
        item(
          'reconciliation-compensation-recovery',
          599,
          652,
          [OWNERSHIP, TERMINAL_ORDERING],
          [
            'compensates a pending reservation and advances a recovered operation to finalization',
            'returns compensation with applied assignments to a retryable state',
          ],
        ),
        item(
          'reconciliation-terminal-event-and-ttl',
          657,
          719,
          [TERMINAL_ORDERING],
          [
            'records the terminal event before finalizing cleanup-pending state without a parent TTL',
            'records the terminal event before clean terminal state and retention TTL',
          ],
        ),
        item(
          'reconciliation-bounded-cleanup',
          724,
          803,
          [OWNERSHIP, TERMINAL_ORDERING],
          [
            'defers batch expiry when gated identifiers exhaust cleanup capacity',
            'completes empty cleanup remainder and applies retention only after terminal event fields exist',
          ],
        ),
        item(
          'reconciliation-exact-reservation-lookup',
          809,
          817,
          [OWNERSHIP],
          [
            'returns missing application and operation-mismatched compensation reservations to retryable',
          ],
        ),
        item(
          'reconciliation-owned-transition',
          825,
          831,
          [OWNERSHIP, TERMINAL_ORDERING],
          [
            'moves a recoverable failed operation through a valid retry transition',
          ],
        ),
        item(
          'reconciliation-owned-lease-release',
          835,
          843,
          [OWNERSHIP, TERMINAL_ORDERING],
          [
            'releases every claimed lease when one public operation recovery fails',
          ],
        ),
        item(
          'reconciliation-correlation-keying',
          850,
          872,
          [OWNERSHIP],
          [
            'attaches an HMAC-only reservation reference under the requested key version',
          ],
        ),
        item(
          'reconciliation-secret-decoding',
          876,
          879,
          [OWNERSHIP],
          [
            'attaches an HMAC-only reservation reference under the requested key version',
          ],
        ),
        item(
          'reconciliation-lease-duration',
          883,
          887,
          [OWNERSHIP, TERMINAL_ORDERING],
          ['uses MongoDB time for atomic lease acquisition and renewal'],
        ),
        item(
          'reconciliation-batch-bound',
          898,
          903,
          [TERMINAL_ORDERING],
          [
            'caps claims at the configured batch size and releases every acquired lease',
          ],
        ),
        item(
          'reconciliation-retention-duration',
          906,
          909,
          [TERMINAL_ORDERING],
          [
            'records the terminal event before clean terminal state and retention TTL',
          ],
        ),
        item(
          'reconciliation-assignment-bound',
          913,
          916,
          [OWNERSHIP, TERMINAL_ORDERING],
          [
            'defers batch expiry when gated identifiers exhaust cleanup capacity',
          ],
        ),
      ],
    },
    {
      source: 'src/members/members.service.ts',
      spec: 'src/members/members.service.spec.ts',
      evidence: ['task-06-review.md', 'task-07-review.md'],
      items: [
        item(
          'member-update-lifecycle',
          169,
          238,
          [OWNERSHIP, REPLAY],
          [
            'reserves a changed email, revokes active sessions, and audits identifier and status changes',
            'releases a newly reserved email when saving the member change fails',
          ],
        ),
        item(
          'member-normalized-login-lookup',
          270,
          281,
          [AUTHORIZATION, OWNERSHIP],
          [
            'looks up credentials with normalized login identifiers and the password hash selected',
          ],
        ),
        item(
          'member-active-auth-requirement',
          285,
          294,
          [AUTHORIZATION],
          [
            'returns the active-member not-found contract when the member does not exist',
          ],
        ),
        item(
          'member-owned-last-login-touch',
          298,
          301,
          [OWNERSHIP],
          ['updates last login atomically without loading the member document'],
        ),
        item(
          'member-credential-owner-denial',
          310,
          325,
          [AUTHORIZATION, OWNERSHIP],
          [
            'leaves member credentials unchanged when the normalized login identifier conflicts',
          ],
        ),
        item(
          'member-credential-lifecycle',
          328,
          367,
          [AUTHORIZATION, OWNERSHIP, REPLAY],
          [
            'sets normalized credentials, increments auth version, and records the actor',
            'recovers a released credential identifier and revokes sessions after saving credentials',
          ],
        ),
        item(
          'member-required-document',
          371,
          379,
          [AUTHORIZATION, OWNERSHIP],
          ['returns not found for missing members'],
        ),
        item(
          'member-auth-version-bump',
          383,
          390,
          [REPLAY],
          ['rejects a missing member when bumping its auth version'],
        ),
        item(
          'member-login-normalization',
          407,
          407,
          [OWNERSHIP],
          [
            'sets normalized credentials, increments auth version, and records the actor',
          ],
        ),
        item(
          'member-identifier-reservation',
          416,
          466,
          [OWNERSHIP],
          [
            'keeps a same-owner active identifier idempotent without a prior member login',
            'reactivates a released reservation with member ownership and no release timestamp',
          ],
        ),
        item(
          'member-identifier-release',
          474,
          489,
          [OWNERSHIP],
          [
            'releases only the newly acquired reservation when credential persistence fails',
          ],
        ),
        item(
          'member-session-revocation',
          493,
          508,
          [OWNERSHIP, REPLAY],
          [
            'initializes an absent auth version and revokes only active member families on status change',
          ],
        ),
      ],
    },
    {
      source: 'src/borrowings/borrowings.service.ts',
      spec: 'src/borrowings/borrowings.service.spec.ts',
      evidence: ['task-08-review.md'],
      items: [
        item(
          'borrowing-create-policy-and-effects',
          58,
          105,
          [AUTHORIZATION, BORROWING_STATE],
          [
            'requires an authenticated staff actor before creating borrowing records',
            'creates a borrowing only after active member, book, category, and membership policy pass',
            'does not change book availability or member loans when borrowing persistence fails',
          ],
        ),
        item(
          'borrowing-return-transition-and-effects',
          113,
          151,
          [AUTHORIZATION, BORROWING_STATE],
          [
            'requires an authenticated staff actor before returning borrowing records',
            'returns an overdue loan at the supplied time without a negative loan count',
            'denies a non-returned loan in an illegal state without writes',
          ],
        ),
        item(
          'borrowing-member-detail-ownership',
          189,
          203,
          [AUTHORIZATION, OWNERSHIP],
          [
            'applies both borrowing and member ObjectId ownership filters for self-service detail',
            'does not reveal a foreign borrowing when the owner filter is absent or wrong',
          ],
        ),
        item(
          'borrowing-member-list-ownership',
          215,
          219,
          [AUTHORIZATION, OWNERSHIP],
          [
            'rejects member self-service queries with a mismatched memberId',
            'uses member ownership and requested pagination values for member borrowing history',
          ],
        ),
        item(
          'borrowing-current-and-overdue-filters',
          232,
          260,
          [BORROWING_STATE],
          [
            'filters current borrowings to unreturned active and overdue records',
            'applies the overdue-only filter before listing overdue borrowings',
          ],
        ),
        item(
          'borrowing-overdue-policy-query',
          267,
          276,
          [BORROWING_STATE, OWNERSHIP],
          [
            'creates a borrowing only after active member, book, category, and membership policy pass',
          ],
        ),
        item(
          'borrowing-required-record',
          283,
          292,
          [BORROWING_STATE],
          [
            'rejects a duplicate return without changing availability or loan count',
            'returns not found when a borrowing lookup has no matching record',
          ],
        ),
        item(
          'borrowing-required-book',
          299,
          308,
          [BORROWING_STATE],
          [
            'creates a borrowing only after active member, book, category, and membership policy pass',
          ],
        ),
        item(
          'borrowing-required-category',
          315,
          324,
          [BORROWING_STATE],
          [
            'creates a borrowing only after active member, book, category, and membership policy pass',
          ],
        ),
        item(
          'borrowing-required-member',
          331,
          340,
          [BORROWING_STATE, OWNERSHIP],
          [
            'creates a borrowing only after active member, book, category, and membership policy pass',
          ],
        ),
        item(
          'borrowing-required-membership-policy',
          347,
          356,
          [BORROWING_STATE],
          [
            'creates a borrowing only after active member, book, category, and membership policy pass',
          ],
        ),
        item(
          'borrowing-transaction-boundary',
          362,
          372,
          [BORROWING_STATE],
          [
            'does not change book availability or member loans when borrowing persistence fails',
            'denies a non-returned loan in an illegal state without writes',
          ],
        ),
        item(
          'borrowing-staff-actor-requirement',
          376,
          380,
          [AUTHORIZATION],
          [
            'requires an authenticated staff actor before creating borrowing records',
            'requires an authenticated staff actor before returning borrowing records',
          ],
        ),
      ],
    },
  ];
  const manifest = JSON.parse(
    readFileSync(
      join(REPOSITORY_ROOT, 'test', 'quality', 'critical-rule-manifest.json'),
      'utf8',
    ),
  );
  const classifiedRules = manifest.rules.map((rule) => {
    const match = /^\[categories: ([^\]]+)\] /.exec(rule.invariant);
    return {
      ...rule,
      categories: match ? match[1].split(' | ') : [],
    };
  });
  const inventory = groups.flatMap((group) =>
    group.items.map((entry) => ({ ...entry, group })),
  );

  assert.deepEqual(
    groups.map((group) => group.source),
    SELECTED_SOURCES,
  );
  assert.deepEqual(
    Object.fromEntries(
      groups.map((group) => [group.source, group.items.length]),
    ),
    {
      'src/auth/token-session.service.ts': 18,
      'src/auth/auth-identifier-repair.service.ts': 26,
      'src/auth/auth-identifier-reconciliation.service.ts': 21,
      'src/members/members.service.ts': 12,
      'src/borrowings/borrowings.service.ts': 13,
    },
  );
  assert.deepEqual(
    Object.fromEntries(
      categories.map((category) => [
        category,
        inventory.filter((entry) => entry.categories.includes(category)).length,
      ]),
    ),
    {
      [AUTHORIZATION]: 23,
      [OWNERSHIP]: 45,
      [REPLAY]: 20,
      [TOKEN_REJECTION]: 5,
      [BORROWING_STATE]: 10,
      [TERMINAL_ORDERING]: 25,
    },
  );
  assert.deepEqual(
    Object.fromEntries(
      SELECTED_SOURCES.map((source) => [
        source,
        classifiedRules.filter((rule) => rule.source === source).length,
      ]),
    ),
    {
      'src/auth/token-session.service.ts': 16,
      'src/auth/auth-identifier-repair.service.ts': 26,
      'src/auth/auth-identifier-reconciliation.service.ts': 22,
      'src/members/members.service.ts': 13,
      'src/borrowings/borrowings.service.ts': 12,
    },
  );
  for (const rule of classifiedRules) {
    assert.ok(
      rule.categories.length > 0,
      `${rule.id}: missing category prefix`,
    );
    assert.equal(
      new Set(rule.categories).size,
      rule.categories.length,
      rule.id,
    );
    for (const category of rule.categories) {
      assert.ok(categories.includes(category), `${rule.id}: ${category}`);
    }
  }
  assert.deepEqual(
    [...new Set(inventory.flatMap((entry) => entry.categories))].sort(),
    [...categories].sort(),
  );

  for (const group of groups) {
    const sourceText = readFileSync(
      join(REPOSITORY_ROOT, ...group.source.split('/')),
      'utf8',
    );
    const sourceLines = sourceText.split(/\r?\n/);
    const specText = readFileSync(
      join(REPOSITORY_ROOT, ...group.spec.split('/')),
      'utf8',
    );
    for (const evidenceFile of group.evidence) {
      assert.match(
        readFileSync(join(plan3Root, evidenceFile), 'utf8'),
        /approved/i,
      );
    }
    for (const entry of group.items) {
      assert.ok(
        Number.isInteger(entry.startLine) &&
          Number.isInteger(entry.endLine) &&
          entry.startLine > 0 &&
          entry.startLine <= entry.endLine &&
          entry.endLine <= sourceLines.length,
        entry.id,
      );
      for (const boundary of [entry.startLine, entry.endLine]) {
        const line = sourceLines[boundary - 1].trim();
        assert.notEqual(line, '', `${entry.id}:${boundary}`);
        assert.doesNotMatch(
          line,
          /^(?:async |private |protected |public ).*\{$/,
          `${entry.id}:${boundary} must be executable, not a signature`,
        );
      }
      assert.ok(entry.tests.length > 0, entry.id);
      for (const title of entry.tests) {
        assert.ok(specText.includes(`'${title}'`), `${entry.id}: ${title}`);
      }
    }
  }

  const coversEveryLine = (rules, entry) => {
    for (let line = entry.startLine; line <= entry.endLine; line += 1) {
      if (
        !rules.some(
          (rule) =>
            rule.source === entry.group.source &&
            rule.startLine <= line &&
            rule.endLine >= line,
        )
      ) {
        return false;
      }
    }
    return true;
  };
  const uncoveredExecutableRanges = inventory
    .filter((entry) => !coversEveryLine(classifiedRules, entry))
    .map((entry) => [
      entry.id,
      entry.group.source,
      entry.startLine,
      entry.endLine,
    ]);
  const missingLineCategoryPairs = inventory.flatMap((entry) =>
    Array.from(
      { length: entry.endLine - entry.startLine + 1 },
      (_, index) => entry.startLine + index,
    ).flatMap((line) =>
      entry.categories
        .filter(
          (category) =>
            !classifiedRules.some(
              (rule) =>
                rule.source === entry.group.source &&
                rule.startLine <= line &&
                rule.endLine >= line &&
                rule.categories.includes(category),
            ),
        )
        .map((category) => [entry.id, line, category]),
    ),
  );

  assert.deepEqual(
    { uncoveredExecutableRanges, missingLineCategoryPairs },
    { uncoveredExecutableRanges: [], missingLineCategoryPairs: [] },
  );
});
