import type { CoverageReport } from './coverage-report';
import type { TestRunSummary } from './test-result-report';
import type { ProducerMetadata, QualityReport } from './report-quality';

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function coverageTable(coverage: CoverageReport): string {
  const rows = [
    '| Metric | Covered | Total | Skipped | Coverage |',
    '| --- | ---: | ---: | ---: | ---: |',
  ];
  for (const metric of [
    'statements',
    'branches',
    'functions',
    'lines',
  ] as const) {
    const result = coverage.metrics[metric];
    rows.push(
      `| ${metric} | ${result.covered} | ${result.total} | ${result.skipped} | ${formatPercent(result.pct)} |`,
    );
  }
  return rows.join('\n');
}

function changedLineCoverageTable(report: QualityReport): string[] {
  if (!report.changedLineCoverage) {
    return [];
  }
  const coverage = report.changedLineCoverage;
  return [
    '## Changed-line coverage',
    '',
    '| Status | Covered | Total | Coverage | Minimum |',
    '| --- | ---: | ---: | ---: | ---: |',
    `| ${coverage.status} | ${coverage.covered} | ${coverage.total} | ${formatPercent(coverage.pct)} | ${formatPercent(coverage.minimum)} |`,
    ...(coverage.missingFiles.length > 0
      ? [
          '',
          'Missing LCOV files:',
          ...coverage.missingFiles.map((path) => `- ${path}`),
        ]
      : []),
    '',
  ];
}

function testTable(summary: TestRunSummary, passedLabel = 'Passed'): string {
  return [
    '| Result | Count |',
    '| --- | ---: |',
    `| ${passedLabel} | ${summary.passed} |`,
    `| Flaky | ${summary.flaky} |`,
    `| Failed | ${summary.failed} |`,
    `| Skipped | ${summary.skipped} |`,
    `| Total | ${summary.total} |`,
    `| Clean pass rate | ${formatPercent(summary.cleanPassRate)} |`,
    `| Eventual pass rate | ${formatPercent(summary.eventualPassRate)} |`,
    ...(summary.suites
      ? [
          `| Passed suites | ${summary.suites.passed} |`,
          `| Failed suites | ${summary.suites.failed} |`,
          `| Skipped suites | ${summary.suites.skipped} |`,
          `| Total suites | ${summary.suites.total} |`,
        ]
      : []),
  ].join('\n');
}

function producerMetadata(
  source: ProducerMetadata,
  representedFiles?: number,
): string {
  return [
    ...(representedFiles === undefined
      ? []
      : [`Source files represented: ${representedFiles}`]),
    `Producer: ${source.tool} ${source.version}`,
    `Source command: \`${source.command}\``,
  ].join('\n');
}

function globalErrorDiagnostics(summary: TestRunSummary): string[] {
  return summary.globalErrors && summary.globalErrors.length > 0
    ? [
        '',
        'Global runner errors:',
        ...summary.globalErrors.map((diagnostic) => `- ${diagnostic}`),
      ]
    : [];
}

function projectTable(summary: TestRunSummary): string {
  const rows = [
    '| Project | First-attempt passed | Flaky | Failed | Skipped | Total | Clean pass rate | Eventual pass rate |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const [project, projectSummary] of Object.entries(
    summary.projects ?? {},
  ).sort(([left], [right]) => left.localeCompare(right))) {
    rows.push(
      `| ${project} | ${projectSummary.passed} | ${projectSummary.flaky} | ${projectSummary.failed} | ${projectSummary.skipped} | ${projectSummary.total} | ${formatPercent(projectSummary.cleanPassRate)} | ${formatPercent(projectSummary.eventualPassRate)} |`,
    );
  }
  return rows.join('\n');
}

function reportMetadata(report: QualityReport): string {
  return [
    `Generated: ${report.generatedAt}`,
    `Node: ${report.toolVersions.node}`,
    ...(Object.keys(report.producerOutcomes).length > 0
      ? [
          '',
          '## Producer outcomes',
          '',
          '| Producer | Outcome |',
          '| --- | --- |',
          ...Object.entries(report.producerOutcomes).map(
            ([producer, outcome]) => `| ${producer} | ${outcome} |`,
          ),
        ]
      : []),
    '',
    '## Quality gate',
    '',
    `Status: ${report.gate.passed ? 'passed' : 'failed'}`,
    ...(report.gate.reasons.length > 0
      ? ['Reasons:', ...report.gate.reasons.map((reason) => `- ${reason}`)]
      : []),
    ...(report.gate.warnings.length > 0
      ? ['Warnings:', ...report.gate.warnings.map((warning) => `- ${warning}`)]
      : []),
  ].join('\n');
}

export function renderQualityMarkdown(report: QualityReport): string {
  if (report.stream === 'backend') {
    return [
      '# Backend coverage and e2e',
      '',
      '## Unit coverage',
      '',
      producerMetadata(report.sources.coverage!, report.coverage!.files),
      '',
      coverageTable(report.coverage!),
      '',
      ...changedLineCoverageTable(report),
      '## Unit tests',
      '',
      producerMetadata(report.sources.unitTests!),
      '',
      testTable(report.unitTests!),
      '',
      '## Backend e2e',
      '',
      producerMetadata(report.sources.e2eTests!),
      '',
      testTable(report.e2eTests!),
      ...globalErrorDiagnostics(report.e2eTests!),
      '',
      reportMetadata(report),
    ].join('\n');
  }

  if (report.stream === 'frontend-unit') {
    return [
      '# Frontend unit coverage',
      '',
      '## Unit coverage',
      '',
      producerMetadata(report.sources.coverage!, report.coverage!.files),
      '',
      coverageTable(report.coverage!),
      '',
      ...changedLineCoverageTable(report),
      '## Unit tests',
      '',
      producerMetadata(report.sources.unitTests!),
      '',
      testTable(report.unitTests!),
      '',
      reportMetadata(report),
    ].join('\n');
  }

  return [
    '# Frontend Playwright e2e',
    '',
    '## Overall',
    '',
    producerMetadata(report.sources.e2eTests!),
    '',
    testTable(report.e2eTests!, 'First-attempt passed'),
    ...globalErrorDiagnostics(report.e2eTests!),
    '',
    '## Per-project',
    '',
    projectTable(report.e2eTests!),
    '',
    reportMetadata(report),
  ].join('\n');
}
