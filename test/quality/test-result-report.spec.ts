import {
  evaluateTestRun,
  parseJestStyleResults,
  parsePlaywrightResults,
} from '../../scripts/quality/test-result-report';

const playwrightResult = {
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
    });
  });

  it('fails a zero-test run even when the producer reports success', () => {
    const summary = parseJestStyleResults({
      numPassedTests: 0,
      numFailedTests: 0,
      numPendingTests: 0,
      numTotalTests: 0,
    });

    expect(evaluateTestRun(summary)).toEqual({
      passed: false,
      reasons: ['zero-tests'],
    });
  });

  it.each([
    {
      numPassedTests: 1,
      numFailedTests: 0,
      numPendingTests: 0,
      numTotalTests: 2,
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
    });
  });

  it('rejects Playwright runs with final failures while reporting flaky passes', () => {
    expect(evaluateTestRun(parsePlaywrightResults(playwrightResult))).toEqual({
      passed: false,
      reasons: ['final-failures:1'],
    });
  });

  it.each([
    {},
    { suites: [{}] },
    { suites: [{ suites: [], specs: [{}] }] },
    {
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
  ])('rejects malformed Playwright output instead of ignoring it: %p', (raw) => {
    expect(() => parsePlaywrightResults(raw)).toThrow('invalid-test-results');
  });
});
