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
  'f337fbc24c78f72d79ebc1263b882c69f9c0078ec8276507e6fb75ffa72f75db';
const TEST_CLOCK_MS = Date.now();
const VALID_REVIEWED_AT = new Date(
  TEST_CLOCK_MS - 24 * 60 * 60 * 1000,
).toISOString();
const VALID_EXPIRES_AT = new Date(
  TEST_CLOCK_MS + 30 * 24 * 60 * 60 * 1000,
).toISOString();

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
      start: { line: 5, column: 0 },
      end: { line: 5, column: 5 },
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
          start: { line: 1, column: 0 },
          end: { line: 1, column: 5 },
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
test('does not compare smoke score with the complete baseline', () => {
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

// Production break caught: inclusive first-line critical overlaps are missed.
test('rejects a surviving mutant overlapping a critical rule', () => {
  const report = makeReport({
    [SELECTED_SOURCES[0]]: [
      makeMutant('Survived', {
        location: {
          start: { line: 1, column: 0 },
          end: { line: 1, column: 5 },
        },
      }),
    ],
  });

  const evaluation = evaluate({ report });

  assert.equal(evaluation.passed, false);
  assert.deepEqual(evaluation.violations, [
    'Critical mutant f337fbc24c78f72d79ebc1263b882c69f9c0078ec8276507e6fb75ffa72f75db (Survived) is not an approved equivalent for critical-rule-1.',
  ]);
  assert.equal(evaluation.criticalFindings[0].manifestLine, 2);
});

// Production break caught: inclusive last-line NoCoverage overlaps are missed.
test('rejects a no-coverage mutant overlapping a critical rule', () => {
  const report = makeReport({
    [SELECTED_SOURCES[0]]: [
      makeMutant('NoCoverage', {
        location: {
          start: { line: 3, column: 0 },
          end: { line: 3, column: 5 },
        },
      }),
    ],
  });

  const evaluation = evaluate({ report });

  assert.equal(evaluation.passed, false);
  assert.equal(evaluation.criticalFindings[0].ruleId, 'critical-rule-1');
  assert.equal(evaluation.criticalFindings[0].manifestLine, 4);
  assert.equal(evaluation.criticalFindings[0].status, 'NoCoverage');
});

// Production break caught: a non-exact fingerprint, rule, or source hash bypasses review.
test('accepts only an exact equivalent fingerprint tied to source SHA and rule id', () => {
  const report = makeReport({
    [SELECTED_SOURCES[0]]: [
      makeMutant('Survived', {
        location: {
          start: { line: 1, column: 0 },
          end: { line: 1, column: 5 },
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
          start: { line: 1, column: 0 },
          end: { line: 1, column: 5 },
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
    assert.throws(() => evaluate({ baseline }), /generatedFromCommit/);
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
});

// Production break caught: a valid manifest is not verified against real source bytes and anchors.
test('validates manifest against temporary source files', () => {
  assert.deepEqual(
    validateCriticalManifest(makeManifest(), sourceByPath),
    makeManifest(),
  );
});
