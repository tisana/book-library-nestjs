import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderQualityMarkdown } from '../../scripts/quality/render-quality-report';
import {
  QualityReport,
  runQualityReportCli,
} from '../../scripts/quality/report-quality';

const coverage = {
  total: {
    statements: { total: 100, covered: 90, skipped: 0, pct: 90 },
    branches: { total: 100, covered: 80, skipped: 0, pct: 80 },
    functions: { total: 100, covered: 85, skipped: 0, pct: 85 },
    lines: { total: 100, covered: 95, skipped: 0, pct: 95 },
  },
  'src/example.ts': {
    statements: { total: 100, covered: 90, skipped: 0, pct: 90 },
    branches: { total: 100, covered: 80, skipped: 0, pct: 80 },
    functions: { total: 100, covered: 85, skipped: 0, pct: 85 },
    lines: { total: 100, covered: 95, skipped: 0, pct: 95 },
  },
};

const unitTests = {
  numPassedTestSuites: 2,
  numFailedTestSuites: 0,
  numPendingTestSuites: 0,
  numTotalTestSuites: 2,
  numPassedTests: 4,
  numFailedTests: 0,
  numPendingTests: 1,
  numTotalTests: 5,
};

const e2eTests = {
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
          ],
        },
      ],
    },
  ],
};

const failedPlaywrightTests = {
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
              results: [{ status: 'failed' }],
            },
          ],
        },
      ],
    },
  ],
};

const flakyPlaywrightTests = {
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

const zeroPlaywrightTests = { suites: [], errors: [] };

function qualityReport(
  stream: QualityReport['stream'],
  overrides: Partial<QualityReport> = {},
): QualityReport {
  const jest = { tool: 'Jest' as const, version: '30.2.0' };
  const vitest = { tool: 'Vitest' as const, version: '4.1.8' };
  const playwright = { tool: 'Playwright' as const, version: '1.60.0' };
  return {
    stream,
    generatedAt: '2026-07-26T00:00:00.000Z',
    toolVersions: { node: 'v25.0.0' },
    producerOutcomes: {},
    sources:
      stream === 'backend'
        ? {
            coverage: { ...jest, command: 'npm run test:cov' },
            unitTests: { ...jest, command: 'npm run test:cov' },
            e2eTests: { ...jest, command: 'npm run test:e2e:report' },
          }
        : stream === 'frontend-unit'
          ? {
              coverage: {
                ...vitest,
                command: 'npm run frontend:test:coverage',
              },
              unitTests: {
                ...vitest,
                command: 'npm run frontend:test:coverage',
              },
            }
          : {
              e2eTests: {
                ...playwright,
                command: 'npm run frontend:test:e2e:report',
              },
            },
    gate: { passed: true, reasons: [], warnings: [] },
    ...overrides,
  };
}

describe('scoped quality reports', () => {
  let fixtureDirectory: string;
  let originalGitHubStepSummary: string | undefined;

  beforeEach(async () => {
    originalGitHubStepSummary = process.env.GITHUB_STEP_SUMMARY;
    delete process.env.GITHUB_STEP_SUMMARY;
    fixtureDirectory = await mkdtemp(join(tmpdir(), 'quality-report-'));
    await Promise.all([
      writeFile(
        join(fixtureDirectory, 'coverage.json'),
        JSON.stringify(coverage),
      ),
      writeFile(join(fixtureDirectory, 'unit.json'), JSON.stringify(unitTests)),
      writeFile(join(fixtureDirectory, 'e2e.json'), JSON.stringify(e2eTests)),
      writeFile(
        join(fixtureDirectory, 'baselines.json'),
        JSON.stringify({
          backend: {
            statements: 80,
            branches: 70,
            functions: 80,
            lines: 90,
          },
        }),
      ),
    ]);
  });

  afterEach(async () => {
    if (originalGitHubStepSummary === undefined) {
      delete process.env.GITHUB_STEP_SUMMARY;
    } else {
      process.env.GITHUB_STEP_SUMMARY = originalGitHubStepSummary;
    }
    await rm(fixtureDirectory, { recursive: true, force: true });
  });

  it('renders each stream separately without combined coverage', () => {
    const backendReport = qualityReport('backend', {
      coverage: {
        scope: 'backend',
        files: 1,
        metrics: coverage.total,
      },
      unitTests: {
        passed: 4,
        failed: 0,
        skipped: 1,
        flaky: 0,
        total: 5,
        cleanPassRate: 100,
        eventualPassRate: 100,
      },
      e2eTests: {
        passed: 1,
        failed: 0,
        skipped: 0,
        flaky: 0,
        total: 1,
        cleanPassRate: 100,
        eventualPassRate: 100,
        projects: {},
      },
    });
    const frontendUnitReport = qualityReport('frontend-unit', {
      coverage: {
        scope: 'frontend',
        files: 1,
        metrics: coverage.total,
      },
      unitTests: {
        passed: 4,
        failed: 0,
        skipped: 1,
        flaky: 0,
        total: 5,
        cleanPassRate: 100,
        eventualPassRate: 100,
      },
    });
    const frontendE2eReport = qualityReport('frontend-e2e', {
      e2eTests: {
        passed: 1,
        failed: 0,
        skipped: 0,
        flaky: 0,
        total: 1,
        cleanPassRate: 100,
        eventualPassRate: 100,
        projects: {
          'desktop-chromium': {
            passed: 1,
            failed: 0,
            skipped: 0,
            flaky: 0,
            total: 1,
            cleanPassRate: 100,
            eventualPassRate: 100,
          },
        },
      },
    });

    expect(renderQualityMarkdown(backendReport)).toContain(
      '# Backend coverage and e2e',
    );
    expect(renderQualityMarkdown(frontendUnitReport)).toContain(
      '# Frontend unit coverage',
    );
    expect(renderQualityMarkdown(frontendE2eReport)).toContain(
      '# Frontend Playwright e2e',
    );
    expect(renderQualityMarkdown(frontendE2eReport)).toContain(
      '| Clean pass rate | 100.00% |',
    );
    expect(renderQualityMarkdown(frontendE2eReport)).toContain(
      '| First-attempt passed | 1 |',
    );
    expect(renderQualityMarkdown(frontendE2eReport)).toContain(
      '| Project | First-attempt passed | Flaky | Failed | Skipped | Total | Clean pass rate | Eventual pass rate |',
    );
    expect(
      [
        renderQualityMarkdown(backendReport),
        renderQualityMarkdown(frontendUnitReport),
        renderQualityMarkdown(frontendE2eReport),
      ].some((markdown) => markdown.includes('Combined coverage')),
    ).toBe(false);
  });

  it('rejects a missing backend input with the affected stream name', async () => {
    await expect(
      runQualityReportCli([
        '--stream',
        'backend',
        '--coverage',
        join(fixtureDirectory, 'coverage.json'),
        '--unit-tests',
        join(fixtureDirectory, 'unit.json'),
        '--baselines',
        join(fixtureDirectory, 'baselines.json'),
      ]),
    ).rejects.toThrow('backend');
  });

  it('rejects malformed JSON with the affected stream name', async () => {
    const malformedPath = join(fixtureDirectory, 'malformed.json');
    await writeFile(malformedPath, '{');

    await expect(
      runQualityReportCli([
        '--stream',
        'frontend-e2e',
        '--e2e-tests',
        malformedPath,
        '--baselines',
        join(fixtureDirectory, 'baselines.json'),
      ]),
    ).rejects.toThrow('frontend-e2e');
  });

  it('rejects a frontend unit report without a baseline unless writing one', async () => {
    const args = [
      '--stream',
      'frontend-unit',
      '--coverage',
      join(fixtureDirectory, 'coverage.json'),
      '--unit-tests',
      join(fixtureDirectory, 'unit.json'),
      '--baselines',
      join(fixtureDirectory, 'baselines.json'),
    ];

    await expect(runQualityReportCli(args)).rejects.toThrow('frontend-unit');

    await runQualityReportCli([...args, '--write-baseline']);
    expect(
      JSON.parse(
        await readFile(join(fixtureDirectory, 'baselines.json'), 'utf8'),
      ),
    ).toMatchObject({
      frontend: { statements: 90, branches: 80, functions: 85, lines: 95 },
    });
  });

  it('rejects zero tests with the affected stream name', async () => {
    const emptyTestsPath = join(fixtureDirectory, 'empty-tests.json');
    await writeFile(
      emptyTestsPath,
      JSON.stringify({
        numPassedTestSuites: 0,
        numFailedTestSuites: 0,
        numPendingTestSuites: 0,
        numTotalTestSuites: 0,
        numPassedTests: 0,
        numFailedTests: 0,
        numPendingTests: 0,
        numTotalTests: 0,
      }),
    );

    await expect(
      runQualityReportCli([
        '--stream',
        'frontend-unit',
        '--coverage',
        join(fixtureDirectory, 'coverage.json'),
        '--unit-tests',
        emptyTestsPath,
        '--baselines',
        join(fixtureDirectory, 'baselines.json'),
        '--write-baseline',
      ]),
    ).rejects.toThrow('frontend-unit');
  });

  it('normalizes backend Jest e2e results instead of treating them as Playwright output', async () => {
    const report = await runQualityReportCli([
      '--stream',
      'backend',
      '--coverage',
      join(fixtureDirectory, 'coverage.json'),
      '--unit-tests',
      join(fixtureDirectory, 'unit.json'),
      '--e2e-tests',
      join(fixtureDirectory, 'unit.json'),
      '--baselines',
      join(fixtureDirectory, 'baselines.json'),
    ]);

    expect(report.e2eTests).toMatchObject({
      passed: 4,
      failed: 0,
      skipped: 1,
      total: 5,
    });
    expect(report.sources).toEqual({
      coverage: {
        tool: 'Jest',
        version: expect.stringMatching(/^\d+\.\d+\.\d+/),
        command: 'npm run test:cov',
      },
      unitTests: {
        tool: 'Jest',
        version: expect.stringMatching(/^\d+\.\d+\.\d+/),
        command: 'npm run test:cov',
      },
      e2eTests: {
        tool: 'Jest',
        version: expect.stringMatching(/^\d+\.\d+\.\d+/),
        command: 'npm run test:e2e:report',
      },
    });
    const markdown = renderQualityMarkdown(report);
    expect(markdown).toContain('Source files represented: 1');
    expect(markdown).toContain('Source command: `npm run test:cov`');
    expect(markdown).toMatch(/Producer: Jest \d+\.\d+\.\d+/);
    expect(markdown).toContain('| Passed suites | 2 |');
  });

  it('reports and gates backend changed-line coverage independently of overall coverage', async () => {
    const diffPath = join(fixtureDirectory, 'changed.diff');
    const lcovPath = join(fixtureDirectory, 'changed.lcov');
    await writeFile(
      diffPath,
      `diff --git a/src/example.ts b/src/example.ts\n--- a/src/example.ts\n+++ b/src/example.ts\n@@ -10,0 +10,1 @@\n+export const example = true;\n`,
    );
    await writeFile(lcovPath, 'SF:src/example.ts\nDA:10,1\nend_of_record\n');

    const report = await runQualityReportCli([
      '--stream',
      'backend',
      '--coverage',
      join(fixtureDirectory, 'coverage.json'),
      '--unit-tests',
      join(fixtureDirectory, 'unit.json'),
      '--e2e-tests',
      join(fixtureDirectory, 'unit.json'),
      '--baselines',
      join(fixtureDirectory, 'baselines.json'),
      '--changed-line-diff',
      diffPath,
      '--changed-line-lcov',
      lcovPath,
    ]);

    expect(report.changedLineCoverage).toMatchObject({
      passed: true,
      covered: 1,
      total: 1,
      pct: 100,
    });
    expect(renderQualityMarkdown(report)).toContain('## Changed-line coverage');
  });

  it('runs both changed-line gates against one repository diff without counting excluded tests', async () => {
    const diffPath = join(fixtureDirectory, 'whole-repository.diff');
    const backendLcovPath = join(fixtureDirectory, 'backend.lcov');
    const frontendLcovPath = join(fixtureDirectory, 'frontend.lcov');
    const frontendBaselinesPath = join(
      fixtureDirectory,
      'frontend-baselines.json',
    );
    await Promise.all([
      writeFile(
        diffPath,
        `diff --git a/src/example.ts b/src/example.ts
--- a/src/example.ts
+++ b/src/example.ts
@@ -10,0 +10,5 @@
+one();
+two();
+three();
+four();
+five();
diff --git a/src/example.spec.ts b/src/example.spec.ts
--- a/src/example.spec.ts
+++ b/src/example.spec.ts
@@ -1,0 +1,1 @@
+it('does not enter backend coverage', () => undefined);
diff --git a/frontend/src/view.tsx b/frontend/src/view.tsx
--- a/frontend/src/view.tsx
+++ b/frontend/src/view.tsx
@@ -20,0 +20,5 @@
+one();
+two();
+three();
+four();
+five();
diff --git a/frontend/src/view.test.tsx b/frontend/src/view.test.tsx
--- a/frontend/src/view.test.tsx
+++ b/frontend/src/view.test.tsx
@@ -1,0 +1,1 @@
+it('does not enter frontend coverage', () => undefined);
`,
      ),
      writeFile(
        backendLcovPath,
        'SF:src/example.ts\nDA:10,1\nDA:11,1\nDA:12,1\nDA:13,1\nDA:14,0\nend_of_record\n',
      ),
      writeFile(
        frontendLcovPath,
        'SF:src\\view.tsx\nDA:20,1\nDA:21,1\nDA:22,1\nDA:23,1\nDA:24,0\nend_of_record\n',
      ),
      writeFile(
        frontendBaselinesPath,
        JSON.stringify({
          backend: {
            statements: 80,
            branches: 70,
            functions: 80,
            lines: 90,
          },
          frontend: {
            statements: 80,
            branches: 70,
            functions: 80,
            lines: 90,
          },
        }),
      ),
    ]);

    const backend = await runQualityReportCli([
      '--stream',
      'backend',
      '--coverage',
      join(fixtureDirectory, 'coverage.json'),
      '--unit-tests',
      join(fixtureDirectory, 'unit.json'),
      '--e2e-tests',
      join(fixtureDirectory, 'unit.json'),
      '--baselines',
      join(fixtureDirectory, 'baselines.json'),
      '--changed-line-diff',
      diffPath,
      '--changed-line-lcov',
      backendLcovPath,
    ]);
    const frontend = await runQualityReportCli([
      '--stream',
      'frontend-unit',
      '--coverage',
      join(fixtureDirectory, 'coverage.json'),
      '--unit-tests',
      join(fixtureDirectory, 'unit.json'),
      '--baselines',
      frontendBaselinesPath,
      '--changed-line-diff',
      diffPath,
      '--changed-line-lcov',
      frontendLcovPath,
    ]);

    expect(backend.changedLineCoverage).toMatchObject({
      status: 'passed',
      pct: 80,
      covered: 4,
      total: 5,
    });
    expect(frontend.changedLineCoverage).toMatchObject({
      status: 'passed',
      pct: 80,
      covered: 4,
      total: 5,
    });
    expect(frontend.sources).toEqual({
      coverage: {
        tool: 'Vitest',
        version: expect.stringMatching(/^\d+\.\d+\.\d+/),
        command: 'npm run frontend:test:coverage',
      },
      unitTests: {
        tool: 'Vitest',
        version: expect.stringMatching(/^\d+\.\d+\.\d+/),
        command: 'npm run frontend:test:coverage',
      },
    });
  });

  it('rejects a backend coverage report whose represented executable-file count differs from the expected denominator', async () => {
    const coverageWith86Files = {
      ...coverage,
      ...Object.fromEntries(
        Array.from({ length: 85 }, (_, index) => [
          `src/represented-${index}.ts`,
          coverage.total,
        ]),
      ),
    };
    const coveragePath = join(fixtureDirectory, 'coverage-with-86-files.json');
    await writeFile(coveragePath, JSON.stringify(coverageWith86Files));

    await expect(
      runQualityReportCli([
        '--stream',
        'backend',
        '--coverage',
        coveragePath,
        '--unit-tests',
        join(fixtureDirectory, 'unit.json'),
        '--e2e-tests',
        join(fixtureDirectory, 'unit.json'),
        '--baselines',
        join(fixtureDirectory, 'baselines.json'),
        '--expected-files',
        '87',
      ]),
    ).rejects.toThrow('backend-source-denominator-mismatch');
  });

  it('writes failed backend gate diagnostics before rejecting the command', async () => {
    const failedE2ePath = join(fixtureDirectory, 'failed-backend-e2e.json');
    const markdownPath = join(fixtureDirectory, 'failed.md');
    const jsonPath = join(fixtureDirectory, 'failed.json');
    const stepSummaryPath = join(fixtureDirectory, 'github-summary.md');
    process.env.GITHUB_STEP_SUMMARY = stepSummaryPath;
    await writeFile(
      failedE2ePath,
      JSON.stringify({
        numPassedTestSuites: 1,
        numFailedTestSuites: 1,
        numPendingTestSuites: 0,
        numTotalTestSuites: 2,
        numPassedTests: 3,
        numFailedTests: 1,
        numPendingTests: 0,
        numTotalTests: 4,
      }),
    );

    await expect(
      runQualityReportCli([
        '--stream',
        'backend',
        '--coverage',
        join(fixtureDirectory, 'coverage.json'),
        '--unit-tests',
        join(fixtureDirectory, 'unit.json'),
        '--e2e-tests',
        failedE2ePath,
        '--baselines',
        join(fixtureDirectory, 'baselines.json'),
        '--markdown',
        markdownPath,
        '--json',
        jsonPath,
      ]),
    ).rejects.toThrow('backend:quality-gate-failed');

    await expect(readFile(markdownPath, 'utf8')).resolves.toContain(
      'final-failures:1',
    );
    await expect(readFile(jsonPath, 'utf8')).resolves.toContain(
      '"passed": false',
    );
    await expect(readFile(stepSummaryPath, 'utf8')).resolves.toContain(
      '# Backend coverage and e2e',
    );
  });

  it('writes failed-suite diagnostics when tests pass but a Jest suite fails', async () => {
    const failedSuitePath = join(fixtureDirectory, 'failed-suite.json');
    const markdownPath = join(fixtureDirectory, 'failed-suite.md');
    const jsonPath = join(fixtureDirectory, 'failed-suite-summary.json');
    await writeFile(
      failedSuitePath,
      JSON.stringify({
        numPassedTestSuites: 1,
        numFailedTestSuites: 1,
        numPendingTestSuites: 0,
        numTotalTestSuites: 2,
        numPassedTests: 1,
        numFailedTests: 0,
        numPendingTests: 0,
        numTotalTests: 1,
      }),
    );

    await expect(
      runQualityReportCli([
        '--stream',
        'backend',
        '--coverage',
        join(fixtureDirectory, 'coverage.json'),
        '--unit-tests',
        join(fixtureDirectory, 'unit.json'),
        '--e2e-tests',
        failedSuitePath,
        '--baselines',
        join(fixtureDirectory, 'baselines.json'),
        '--markdown',
        markdownPath,
        '--json',
        jsonPath,
      ]),
    ).rejects.toThrow('e2e-tests:failed-suites:1');

    await expect(readFile(markdownPath, 'utf8')).resolves.toContain(
      '| Failed suites | 1 |',
    );
    await expect(readFile(jsonPath, 'utf8')).resolves.toContain('"failed": 1');
  });

  it('rejects a backend Jest e2e run with zero tests', async () => {
    const zeroE2ePath = join(fixtureDirectory, 'zero-backend-e2e.json');
    await writeFile(
      zeroE2ePath,
      JSON.stringify({
        numPassedTestSuites: 0,
        numFailedTestSuites: 0,
        numPendingTestSuites: 0,
        numTotalTestSuites: 0,
        numPassedTests: 0,
        numFailedTests: 0,
        numPendingTests: 0,
        numTotalTests: 0,
      }),
    );

    await expect(
      runQualityReportCli([
        '--stream',
        'backend',
        '--coverage',
        join(fixtureDirectory, 'coverage.json'),
        '--unit-tests',
        join(fixtureDirectory, 'unit.json'),
        '--e2e-tests',
        zeroE2ePath,
        '--baselines',
        join(fixtureDirectory, 'baselines.json'),
      ]),
    ).rejects.toThrow('backend');
  });

  it('rejects a frontend coverage regression against its baseline', async () => {
    const lowerCoveragePath = join(fixtureDirectory, 'lower-coverage.json');
    const frontendBaselinesPath = join(
      fixtureDirectory,
      'frontend-baselines.json',
    );
    await writeFile(
      lowerCoveragePath,
      JSON.stringify({
        ...coverage,
        total: {
          ...coverage.total,
          branches: { total: 100, covered: 69, skipped: 0, pct: 69 },
        },
      }),
    );
    await writeFile(
      frontendBaselinesPath,
      JSON.stringify({
        backend: { statements: 80, branches: 70, functions: 80, lines: 90 },
        frontend: { statements: 90, branches: 80, functions: 85, lines: 95 },
      }),
    );

    await expect(
      runQualityReportCli([
        '--stream',
        'frontend-unit',
        '--coverage',
        lowerCoveragePath,
        '--unit-tests',
        join(fixtureDirectory, 'unit.json'),
        '--baselines',
        frontendBaselinesPath,
      ]),
    ).rejects.toThrow(
      'frontend-unit:quality-gate-failed:coverage:branches:69<80',
    );
  });

  it.each([
    ['final failures', failedPlaywrightTests, 'final-failures:1'],
    ['zero tests', zeroPlaywrightTests, 'zero-tests'],
  ])(
    'rejects frontend Playwright e2e %s',
    async (_case, playwrightResults, reason) => {
      const e2ePath = join(fixtureDirectory, `${reason}.json`);
      await writeFile(e2ePath, JSON.stringify(playwrightResults));

      await expect(
        runQualityReportCli([
          '--stream',
          'frontend-e2e',
          '--e2e-tests',
          e2ePath,
          '--baselines',
          join(fixtureDirectory, 'baselines.json'),
        ]),
      ).rejects.toThrow(`frontend-e2e:quality-gate-failed:e2e-tests:${reason}`);
    },
  );

  it('writes Playwright top-level error diagnostics even when its test passed', async () => {
    const e2ePath = join(fixtureDirectory, 'playwright-global-error.json');
    const markdownPath = join(fixtureDirectory, 'playwright-global-error.md');
    const jsonPath = join(
      fixtureDirectory,
      'playwright-global-error-summary.json',
    );
    await writeFile(
      e2ePath,
      JSON.stringify({
        errors: [{ message: 'global teardown failed' }],
        suites: e2eTests.suites,
      }),
    );

    await expect(
      runQualityReportCli([
        '--stream',
        'frontend-e2e',
        '--e2e-tests',
        e2ePath,
        '--baselines',
        join(fixtureDirectory, 'baselines.json'),
        '--markdown',
        markdownPath,
        '--json',
        jsonPath,
      ]),
    ).rejects.toThrow('e2e-tests:global-errors:1');

    await expect(readFile(markdownPath, 'utf8')).resolves.toContain(
      'Global runner errors:\n- global teardown failed',
    );
    await expect(readFile(jsonPath, 'utf8')).resolves.toContain(
      '"globalErrors": [\n      "global teardown failed"\n    ]',
    );
  });

  it('fails a clean parsed report when any preserved producer outcome was not successful', async () => {
    const markdownPath = join(fixtureDirectory, 'producer-failure.md');
    const jsonPath = join(fixtureDirectory, 'producer-failure.json');

    await expect(
      runQualityReportCli([
        '--stream',
        'backend',
        '--coverage',
        join(fixtureDirectory, 'coverage.json'),
        '--unit-tests',
        join(fixtureDirectory, 'unit.json'),
        '--e2e-tests',
        join(fixtureDirectory, 'unit.json'),
        '--baselines',
        join(fixtureDirectory, 'baselines.json'),
        '--producer-outcome',
        'backend-unit=success',
        '--producer-outcome',
        'backend-e2e=failure',
        '--markdown',
        markdownPath,
        '--json',
        jsonPath,
      ]),
    ).rejects.toThrow('producer:backend-e2e:failure');

    await expect(readFile(markdownPath, 'utf8')).resolves.toContain(
      '| backend-e2e | failure |',
    );
    await expect(readFile(jsonPath, 'utf8')).resolves.toContain(
      '"backend-e2e": "failure"',
    );
  });

  it('writes non-blocking Playwright flakiness warnings to Markdown and JSON', async () => {
    const e2ePath = join(fixtureDirectory, 'flaky-playwright.json');
    const markdownPath = join(fixtureDirectory, 'flaky.md');
    const jsonPath = join(fixtureDirectory, 'flaky.json');
    await writeFile(e2ePath, JSON.stringify(flakyPlaywrightTests));

    await expect(
      runQualityReportCli([
        '--stream',
        'frontend-e2e',
        '--e2e-tests',
        e2ePath,
        '--baselines',
        join(fixtureDirectory, 'baselines.json'),
        '--markdown',
        markdownPath,
        '--json',
        jsonPath,
      ]),
    ).resolves.toMatchObject({
      sources: {
        e2eTests: {
          tool: 'Playwright',
          version: expect.stringMatching(/^\d+\.\d+\.\d+/),
          command: 'npm run frontend:test:e2e:report',
        },
      },
      gate: {
        passed: true,
        reasons: [],
        warnings: ['e2e-tests:flaky-tests:1'],
      },
    });

    await expect(readFile(markdownPath, 'utf8')).resolves.toContain(
      'Warnings:\n- e2e-tests:flaky-tests:1',
    );
    await expect(readFile(jsonPath, 'utf8')).resolves.toContain(
      '"warnings": [\n      "e2e-tests:flaky-tests:1"\n    ]',
    );
  });

  it('does not write reports, summaries, or baselines in check-only mode', async () => {
    const markdownPath = join(fixtureDirectory, 'check-only.md');
    const jsonPath = join(fixtureDirectory, 'check-only.json');
    const stepSummaryPath = join(fixtureDirectory, 'check-only-summary.md');
    const baselinePath = join(fixtureDirectory, 'baselines.json');
    const originalBaselines = await readFile(baselinePath, 'utf8');
    process.env.GITHUB_STEP_SUMMARY = stepSummaryPath;

    await expect(
      runQualityReportCli([
        '--stream',
        'backend',
        '--coverage',
        join(fixtureDirectory, 'coverage.json'),
        '--unit-tests',
        join(fixtureDirectory, 'unit.json'),
        '--e2e-tests',
        join(fixtureDirectory, 'unit.json'),
        '--baselines',
        baselinePath,
        '--markdown',
        markdownPath,
        '--json',
        jsonPath,
        '--write-baseline',
        '--check-only',
      ]),
    ).resolves.toMatchObject({ stream: 'backend', gate: { passed: true } });

    await expect(readFile(markdownPath, 'utf8')).rejects.toThrow();
    await expect(readFile(jsonPath, 'utf8')).rejects.toThrow();
    await expect(readFile(stepSummaryPath, 'utf8')).rejects.toThrow();
    await expect(readFile(baselinePath, 'utf8')).resolves.toBe(
      originalBaselines,
    );
  });
});
