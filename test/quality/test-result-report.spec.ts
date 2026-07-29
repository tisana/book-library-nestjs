import {
  evaluateTestRun,
  parseJestStyleResults,
  parsePlaywrightResults,
} from '../../scripts/quality/test-result-report';

const playwrightResult = {
  errors: [],
  suites: [
    {
      suites: [],
      specs: [
        {
          tests: [
            {
              projectName: 'desktop-chromium',
              expectedStatus: 'passed',
              results: [{ status: 'passed' }],
            },
            {
              projectName: 'desktop-chromium',
              expectedStatus: 'passed',
              results: [{ status: 'failed' }, { status: 'passed' }],
            },
            {
              projectName: 'mobile-chromium',
              expectedStatus: 'passed',
              results: [{ status: 'failed' }, { status: 'failed' }],
            },
            {
              projectName: 'mobile-chromium',
              expectedStatus: 'skipped',
              results: [{ status: 'skipped' }],
            },
          ],
        },
      ],
    },
  ],
};

describe('test result normalization', () => {
  it('normalizes Jest and Vitest counts without treating skips as passes', () => {
    expect(
      parseJestStyleResults({
        numPassedTestSuites: 2,
        numFailedTestSuites: 1,
        numPendingTestSuites: 1,
        numTotalTestSuites: 4,
        numPassedTests: 8,
        numFailedTests: 1,
        numPendingTests: 2,
        numTotalTests: 11,
      }),
    ).toEqual({
      passed: 8,
      failed: 1,
      skipped: 2,
      flaky: 0,
      total: 11,
      cleanPassRate: 88.89,
      eventualPassRate: 88.89,
      suites: {
        passed: 2,
        failed: 1,
        skipped: 1,
        total: 4,
      },
    });
  });

  it('fails a zero-test run even when the producer reports success', () => {
    const summary = parseJestStyleResults({
      numPassedTestSuites: 0,
      numFailedTestSuites: 0,
      numPendingTestSuites: 0,
      numTotalTestSuites: 0,
      numPassedTests: 0,
      numFailedTests: 0,
      numPendingTests: 0,
      numTotalTests: 0,
    });

    expect(evaluateTestRun(summary)).toEqual({
      passed: false,
      reasons: ['zero-tests'],
      warnings: [],
    });
  });

  it('fails a Jest or Vitest run with a failed suite even when every reported test passed', () => {
    const summary = parseJestStyleResults({
      numPassedTestSuites: 1,
      numFailedTestSuites: 1,
      numPendingTestSuites: 0,
      numTotalTestSuites: 2,
      numPassedTests: 1,
      numFailedTests: 0,
      numPendingTests: 0,
      numTotalTests: 1,
    });

    expect(evaluateTestRun(summary)).toEqual({
      passed: false,
      reasons: ['failed-suites:1'],
      warnings: [],
    });
  });

  it.each([
    {
      numPassedTests: 1,
      numFailedTests: 0,
      numPendingTests: 0,
      numTotalTests: 1,
    },
    {
      numPassedTests: -1,
      numFailedTests: 0,
      numPendingTests: 0,
      numTotalTests: 0,
    },
    {
      numPassedTests: 1.5,
      numFailedTests: 0,
      numPendingTests: 0,
      numTotalTests: 1.5,
    },
    {
      numPassedTests: Number.POSITIVE_INFINITY,
      numFailedTests: 0,
      numPendingTests: 0,
      numTotalTests: Number.POSITIVE_INFINITY,
    },
  ])('rejects malformed Jest or Vitest counts: %p', (raw) => {
    expect(() => parseJestStyleResults(raw)).toThrow('invalid-test-results');
  });

  it('normalizes Playwright first-pass, flaky, failure, skip, and project results', () => {
    expect(parsePlaywrightResults(playwrightResult)).toEqual({
      passed: 1,
      failed: 1,
      skipped: 1,
      flaky: 1,
      total: 4,
      cleanPassRate: 33.33,
      eventualPassRate: 66.67,
      projects: {
        'desktop-chromium': {
          passed: 1,
          failed: 0,
          skipped: 0,
          flaky: 1,
          total: 2,
          cleanPassRate: 50,
          eventualPassRate: 100,
        },
        'mobile-chromium': {
          passed: 0,
          failed: 1,
          skipped: 1,
          flaky: 0,
          total: 2,
          cleanPassRate: 0,
          eventualPassRate: 0,
        },
      },
      globalErrors: [],
    });
  });

  it('aggregates every project from nested Playwright suites', () => {
    const nestedProjectResults = {
      errors: [],
      suites: [
        {
          specs: [],
          suites: [
            {
              specs: [
                {
                  tests: [
                    {
                      projectName: 'desktop-chromium',
                      expectedStatus: 'passed',
                      results: [{ status: 'passed' }],
                    },
                  ],
                },
              ],
              suites: [
                {
                  specs: [
                    {
                      tests: [
                        {
                          projectName: 'tablet-chromium',
                          expectedStatus: 'passed',
                          results: [{ status: 'passed' }],
                        },
                        {
                          projectName: 'mobile-chromium',
                          expectedStatus: 'passed',
                          results: [{ status: 'passed' }],
                        },
                      ],
                    },
                  ],
                  suites: [],
                },
              ],
            },
          ],
        },
      ],
    };

    const summary = parsePlaywrightResults(nestedProjectResults);

    expect(summary.total).toBe(3);
    expect(summary.passed).toBe(3);
    expect(summary.projects).toMatchObject({
      'desktop-chromium': { total: 1, passed: 1 },
      'tablet-chromium': { total: 1, passed: 1 },
      'mobile-chromium': { total: 1, passed: 1 },
    });
  });

  it('accepts Playwright leaf suites that omit an empty nested-suite array', () => {
    const actualPlaywrightLeafSuite = {
      errors: [],
      suites: [
        {
          specs: [
            {
              tests: [
                {
                  projectName: 'desktop-chromium',
                  expectedStatus: 'passed',
                  results: [{ status: 'passed' }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(parsePlaywrightResults(actualPlaywrightLeafSuite)).toMatchObject({
      passed: 1,
      failed: 0,
      skipped: 0,
      flaky: 0,
      total: 1,
      projects: { 'desktop-chromium': { passed: 1, total: 1 } },
    });
  });

  it('rejects Playwright runs with final failures while reporting flaky passes', () => {
    expect(evaluateTestRun(parsePlaywrightResults(playwrightResult))).toEqual({
      passed: false,
      reasons: ['final-failures:1'],
      warnings: ['flaky-tests:1'],
    });
  });

  it('passes a flaky-only Playwright run while reporting a flakiness warning', () => {
    const flakyOnlyPlaywrightResult = {
      errors: [],
      suites: [
        {
          suites: [],
          specs: [
            {
              tests: [
                {
                  projectName: 'desktop-chromium',
                  expectedStatus: 'passed',
                  results: [{ status: 'failed' }, { status: 'passed' }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(
      evaluateTestRun(parsePlaywrightResults(flakyOnlyPlaywrightResult)),
    ).toEqual({
      passed: true,
      reasons: [],
      warnings: ['flaky-tests:1'],
    });
  });

  it('fails a Playwright run with one passed test and a top-level runner error', () => {
    const summary = parsePlaywrightResults({
      errors: [{ message: 'global setup failed' }],
      suites: [
        {
          suites: [],
          specs: [
            {
              tests: [
                {
                  projectName: 'desktop-chromium',
                  expectedStatus: 'passed',
                  results: [{ status: 'passed' }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(summary.globalErrors).toEqual(['global setup failed']);
    expect(evaluateTestRun(summary)).toEqual({
      passed: false,
      reasons: ['global-errors:1'],
      warnings: [],
    });
  });

  it.each([
    {},
    { suites: [], errors: 'not-an-array' },
    { suites: [], errors: [{}] },
    { suites: [{}], errors: [] },
    { suites: [{ suites: [], specs: [{}] }], errors: [] },
    {
      errors: [],
      suites: [
        {
          suites: [],
          specs: [
            {
              tests: [
                {
                  expectedStatus: 'passed',
                  results: [{ status: 'passed' }],
                },
              ],
            },
          ],
        },
      ],
    },
  ])(
    'rejects malformed Playwright output instead of ignoring it: %p',
    (raw) => {
      expect(() => parsePlaywrightResults(raw)).toThrow('invalid-test-results');
    },
  );
});
