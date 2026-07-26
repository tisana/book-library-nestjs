export interface TestRunSummary {
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  total: number;
  cleanPassRate: number;
  eventualPassRate: number;
  projects?: Record<string, TestRunSummary>;
}

interface TestRunCounts {
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  total: number;
}

function percentage(numerator: number, denominator: number): number {
  return denominator === 0
    ? 0
    : Math.round((numerator / denominator) * 10_000) / 100;
}

function createSummary(counts: TestRunCounts): TestRunSummary {
  const executed = counts.passed + counts.flaky + counts.failed;

  return {
    ...counts,
    cleanPassRate: percentage(counts.passed, executed),
    eventualPassRate: percentage(counts.passed + counts.flaky, executed),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberField(raw: unknown, field: string): number {
  if (!isRecord(raw) || typeof raw[field] !== 'number') {
    throw new Error('invalid-test-results');
  }

  return raw[field];
}

export function parseJestStyleResults(raw: unknown): TestRunSummary {
  const passed = numberField(raw, 'numPassedTests');
  const failed = numberField(raw, 'numFailedTests');
  const skipped = numberField(raw, 'numPendingTests');
  const total = numberField(raw, 'numTotalTests');

  return createSummary({ passed, failed, skipped, flaky: 0, total });
}

function addResult(summary: TestRunCounts, target: keyof TestRunCounts): void {
  summary[target] += 1;
  summary.total += 1;
}

function classifyPlaywrightTest(test: Record<string, unknown>): keyof TestRunCounts {
  const results = Array.isArray(test.results) ? test.results : [];
  const finalResult = results[results.length - 1];
  const finalStatus = isRecord(finalResult) ? finalResult.status : undefined;

  if (test.expectedStatus === 'skipped' || finalStatus === 'skipped') {
    return 'skipped';
  }

  if (finalStatus === 'passed') {
    return results.length > 1 ? 'flaky' : 'passed';
  }

  return 'failed';
}

function visitSuites(
  suites: unknown,
  summary: TestRunCounts,
  projects: Record<string, TestRunCounts>,
): void {
  if (!Array.isArray(suites)) {
    return;
  }

  for (const suite of suites) {
    if (!isRecord(suite)) {
      continue;
    }

    const specs = Array.isArray(suite.specs) ? suite.specs : [];
    for (const spec of specs) {
      if (!isRecord(spec) || !Array.isArray(spec.tests)) {
        continue;
      }

      for (const test of spec.tests) {
        if (!isRecord(test) || typeof test.projectName !== 'string') {
          continue;
        }

        const classification = classifyPlaywrightTest(test);
        addResult(summary, classification);
        const project = (projects[test.projectName] ??= {
          passed: 0,
          failed: 0,
          skipped: 0,
          flaky: 0,
          total: 0,
        });
        addResult(project, classification);
      }
    }

    visitSuites(suite.suites, summary, projects);
  }
}

export function parsePlaywrightResults(raw: unknown): TestRunSummary {
  const counts: TestRunCounts = {
    passed: 0,
    failed: 0,
    skipped: 0,
    flaky: 0,
    total: 0,
  };
  const projects: Record<string, TestRunCounts> = {};

  visitSuites(isRecord(raw) ? raw.suites : undefined, counts, projects);

  return {
    ...createSummary(counts),
    projects: Object.fromEntries(
      Object.entries(projects).map(([name, projectCounts]) => [
        name,
        createSummary(projectCounts),
      ]),
    ),
  };
}

export function evaluateTestRun(summary: TestRunSummary): {
  passed: boolean;
  reasons: string[];
} {
  const reasons = [
    ...(summary.passed + summary.flaky + summary.failed === 0
      ? ['zero-tests']
      : []),
    ...(summary.failed > 0 ? [`final-failures:${summary.failed}`] : []),
  ];

  return { passed: reasons.length === 0, reasons };
}
