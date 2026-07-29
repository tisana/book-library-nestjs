import type { CoverageReport } from './coverage-report';
import type { TestRunSummary } from './test-result-report';
import type { QualityReport } from './report-quality';

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function coverageTable(coverage: CoverageReport): string {
  const rows = ['| Metric | Covered | Total | Skipped | Coverage |', '| --- | ---: | ---: | ---: | ---: |'];
  for (const metric of ['statements', 'branches', 'functions', 'lines'] as const) {
    const result = coverage.metrics[metric];
    rows.push(
      `| ${metric} | ${result.covered} | ${result.total} | ${result.skipped} | ${formatPercent(result.pct)} |`,
    );
  }
  return rows.join('\n');
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
  ].join('\n');
}

function projectTable(summary: TestRunSummary): string {
  const rows = [
    '| Project | First-attempt passed | Flaky | Failed | Skipped | Total | Clean pass rate | Eventual pass rate |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const [project, projectSummary] of Object.entries(summary.projects ?? {}).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
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
      coverageTable(report.coverage!),
      '',
      '## Unit tests',
      '',
      testTable(report.unitTests!),
      '',
      '## Backend e2e',
      '',
      testTable(report.e2eTests!),
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
      coverageTable(report.coverage!),
      '',
      '## Unit tests',
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
    testTable(report.e2eTests!, 'First-attempt passed'),
    '',
    '## Per-project',
    '',
    projectTable(report.e2eTests!),
    '',
    reportMetadata(report),
  ].join('\n');
}
