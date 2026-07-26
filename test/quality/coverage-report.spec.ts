import {
  evaluateCoverage,
  parseCoverageSummary,
  ratchetCoverageBaseline,
} from '../../scripts/quality/coverage-report';

const summary = {
  total: {
    lines: { total: 100, covered: 76, skipped: 0, pct: 76 },
    statements: { total: 110, covered: 82, skipped: 0, pct: 74.54 },
    functions: { total: 20, covered: 15, skipped: 0, pct: 75 },
    branches: { total: 40, covered: 28, skipped: 0, pct: 70 },
  },
  'C:/repo/src/example.ts': {
    lines: { total: 100, covered: 76, skipped: 0, pct: 76 },
    statements: { total: 110, covered: 82, skipped: 0, pct: 74.54 },
    functions: { total: 20, covered: 15, skipped: 0, pct: 75 },
    branches: { total: 40, covered: 28, skipped: 0, pct: 70 },
  },
};

describe('coverage report', () => {
  it('normalizes totals and counts represented production files', () => {
    expect(parseCoverageSummary(summary, 'backend')).toEqual({
      scope: 'backend',
      files: 1,
      metrics: summary.total,
    });
  });

  it.each([undefined, null, {}, { total: {} }])(
    'rejects missing or malformed totals: %p',
    (raw) => {
      expect(() => parseCoverageSummary(raw, 'backend')).toThrow(
        'invalid-coverage-summary',
      );
    },
  );

  it.each([
    {
      ...summary,
      total: {
        ...summary.total,
        lines: { total: 10, covered: 11, skipped: 0, pct: 100 },
      },
    },
    {
      ...summary,
      total: {
        ...summary.total,
        lines: { total: 10, covered: 8, skipped: 3, pct: 80 },
      },
    },
    {
      ...summary,
      total: {
        ...summary.total,
        lines: { total: 10, covered: 8, skipped: 0, pct: 101 },
      },
    },
  ])('rejects impossible metric ranges and counts', (raw) => {
    expect(() => parseCoverageSummary(raw, 'backend')).toThrow(
      'invalid-coverage-summary',
    );
  });

  it('reports every dimension below its baseline', () => {
    const report = parseCoverageSummary(summary, 'backend');
    expect(
      evaluateCoverage(report, {
        statements: 75,
        branches: 71,
        functions: 75,
        lines: 77,
      }),
    ).toMatchObject({
      passed: false,
      failures: [
        { metric: 'statements', actual: 74.54, required: 75 },
        { metric: 'branches', actual: 70, required: 71 },
        { metric: 'lines', actual: 76, required: 77 },
      ],
    });
  });

  it('ratchets upward without lowering an existing dimension', () => {
    expect(
      ratchetCoverageBaseline(
        { statements: 70, branches: 65, functions: 72, lines: 71 },
        { statements: 69, branches: 67, functions: 80, lines: 70 },
      ),
    ).toEqual({
      statements: 70,
      branches: 67,
      functions: 80,
      lines: 71,
    });
  });
});
