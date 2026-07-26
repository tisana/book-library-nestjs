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

function qualityReport(
  stream: QualityReport['stream'],
  overrides: Partial<QualityReport> = {},
): QualityReport {
  return {
    stream,
    generatedAt: '2026-07-26T00:00:00.000Z',
    toolVersions: { node: 'v25.0.0' },
    gate: { passed: true, reasons: [] },
    ...overrides,
  };
}

describe('scoped quality reports', () => {
  let fixtureDirectory: string;

  beforeEach(async () => {
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
});
