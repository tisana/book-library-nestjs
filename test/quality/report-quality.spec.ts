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
  numPassedTests: 4,
  numFailedTests: 0,
  numPendingTests: 1,
  numTotalTests: 5,
};

const e2eTests = {
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

const zeroPlaywrightTests = { suites: [] };

function qualityReport(
  stream: QualityReport['stream'],
  overrides: Partial<QualityReport> = {},
): QualityReport {
  return {
    stream,
    generatedAt: '2026-07-26T00:00:00.000Z',
    toolVersions: { node: 'v25.0.0' },
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
      writeFile(join(fixtureDirectory, 'coverage.json'), JSON.stringify(coverage)),
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
    expect(JSON.parse(await readFile(join(fixtureDirectory, 'baselines.json'), 'utf8')))
      .toMatchObject({
        frontend: { statements: 90, branches: 80, functions: 85, lines: 95 },
      });
  });

  it('rejects zero tests with the affected stream name', async () => {
    const emptyTestsPath = join(fixtureDirectory, 'empty-tests.json');
    await writeFile(
      emptyTestsPath,
      JSON.stringify({
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

    await expect(readFile(markdownPath, 'utf8')).resolves.toContain('final-failures:1');
    await expect(readFile(jsonPath, 'utf8')).resolves.toContain('"passed": false');
    await expect(readFile(stepSummaryPath, 'utf8')).resolves.toContain(
      '# Backend coverage and e2e',
    );
  });

  it('rejects a backend Jest e2e run with zero tests', async () => {
    const zeroE2ePath = join(fixtureDirectory, 'zero-backend-e2e.json');
    await writeFile(
      zeroE2ePath,
      JSON.stringify({
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
    const frontendBaselinesPath = join(fixtureDirectory, 'frontend-baselines.json');
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
    ).rejects.toThrow('frontend-unit:quality-gate-failed:coverage:branches:69<80');
  });

  it.each([
    ['final failures', failedPlaywrightTests, 'final-failures:1'],
    ['zero tests', zeroPlaywrightTests, 'zero-tests'],
  ])('rejects frontend Playwright e2e %s', async (_case, playwrightResults, reason) => {
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
    await expect(readFile(baselinePath, 'utf8')).resolves.toBe(originalBaselines);
  });
});
