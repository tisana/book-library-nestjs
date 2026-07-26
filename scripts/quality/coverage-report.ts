export type CoverageMetricName =
  | 'statements'
  | 'branches'
  | 'functions'
  | 'lines';

export type CoverageScope = 'backend' | 'frontend';

export interface CoverageMetric {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

export type CoverageMinimums = Record<CoverageMetricName, number>;

export interface CoverageGate {
  passed: boolean;
  failures: Array<{
    metric: CoverageMetricName;
    actual: number;
    required: number;
  }>;
}

export interface CoverageReport {
  scope: CoverageScope;
  files: number;
  metrics: Record<CoverageMetricName, CoverageMetric>;
}

export interface CoverageBaselineFile {
  backend: CoverageMinimums;
  frontend?: CoverageMinimums;
}

const metricNames: CoverageMetricName[] = [
  'statements',
  'branches',
  'functions',
  'lines',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCoverageMetric(value: unknown): value is CoverageMetric {
  if (!isRecord(value)) {
    return false;
  }

  return ['total', 'covered', 'skipped', 'pct'].every(
    (field) =>
      typeof value[field] === 'number' &&
      Number.isFinite(value[field]) &&
      value[field] >= 0,
  );
}

export function parseCoverageSummary(
  raw: unknown,
  scope: CoverageScope,
): CoverageReport {
  if (!isRecord(raw) || !isRecord(raw.total)) {
    throw new Error('invalid-coverage-summary');
  }

  const metrics = {} as Record<CoverageMetricName, CoverageMetric>;
  for (const metric of metricNames) {
    if (!isCoverageMetric(raw.total[metric])) {
      throw new Error('invalid-coverage-summary');
    }
    metrics[metric] = raw.total[metric];
  }

  return {
    scope,
    files: Object.keys(raw).filter((key) => key !== 'total').length,
    metrics,
  };
}

export function evaluateCoverage(
  report: CoverageReport,
  minimums: CoverageMinimums,
): CoverageGate {
  const failures = metricNames.flatMap((metric) => {
    const actual = report.metrics[metric].pct;
    const required = minimums[metric];

    return actual < required ? [{ metric, actual, required }] : [];
  });

  return { passed: failures.length === 0, failures };
}

export function ratchetCoverageBaseline(
  current: CoverageMinimums | undefined,
  measured: CoverageMinimums,
): CoverageMinimums {
  return {
    statements: Math.max(current?.statements ?? 0, measured.statements),
    branches: Math.max(current?.branches ?? 0, measured.branches),
    functions: Math.max(current?.functions ?? 0, measured.functions),
    lines: Math.max(current?.lines ?? 0, measured.lines),
  };
}
