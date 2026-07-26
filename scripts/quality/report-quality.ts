import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  evaluateCoverage,
  parseCoverageSummary,
  ratchetCoverageBaseline,
  type CoverageBaselineFile,
  type CoverageMinimums,
  type CoverageReport,
} from './coverage-report';
import { renderQualityMarkdown } from './render-quality-report';
import {
  evaluateTestRun,
  parseJestStyleResults,
  parsePlaywrightResults,
  type TestRunSummary,
} from './test-result-report';

export type QualityStream = 'backend' | 'frontend-unit' | 'frontend-e2e';

export interface QualityReport {
  stream: QualityStream;
  generatedAt: string;
  toolVersions: { node: string };
  coverage?: CoverageReport;
  unitTests?: TestRunSummary;
  e2eTests?: TestRunSummary;
  gate: { passed: boolean; reasons: string[] };
}

interface QualityReportOptions {
  stream?: string;
  coverage?: string;
  unitTests?: string;
  e2eTests?: string;
  baselines?: string;
  markdown?: string;
  json?: string;
  writeBaseline: boolean;
  checkOnly: boolean;
}

type ValueOption =
  | 'stream'
  | 'coverage'
  | 'unitTests'
  | 'e2eTests'
  | 'baselines'
  | 'markdown'
  | 'json';

const valueFlags: Record<string, ValueOption> = {
  '--stream': 'stream',
  '--coverage': 'coverage',
  '--unit-tests': 'unitTests',
  '--e2e-tests': 'e2eTests',
  '--baselines': 'baselines',
  '--markdown': 'markdown',
  '--json': 'json',
};

function parseArguments(arguments_: string[]): QualityReportOptions {
  const options: QualityReportOptions = { writeBaseline: false, checkOnly: false };

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--write-baseline' || argument === '--check-only') {
      const key = argument === '--write-baseline' ? 'writeBaseline' : 'checkOnly';
      if (options[key]) {
        throw new Error(`invalid-quality-report:duplicate-${argument}`);
      }
      options[key] = true;
      continue;
    }

    const key = valueFlags[argument];
    const value = arguments_[index + 1];
    if (!key || !value || value.startsWith('--') || options[key] !== undefined) {
      throw new Error(`invalid-quality-report:${argument}`);
    }
    (options as Record<ValueOption, string | undefined>)[key] = value;
    index += 1;
  }

  return options;
}

function assertStream(value: string | undefined): QualityStream {
  if (value === 'backend' || value === 'frontend-unit' || value === 'frontend-e2e') {
    return value;
  }
  throw new Error(`invalid-quality-report:stream:${value ?? 'missing'}`);
}

function assertInputs(stream: QualityStream, options: QualityReportOptions): void {
  const expected =
    stream === 'backend'
      ? { coverage: true, unitTests: true, e2eTests: true }
      : stream === 'frontend-unit'
        ? { coverage: true, unitTests: true, e2eTests: false }
        : { coverage: false, unitTests: false, e2eTests: true };

  for (const [key, required] of Object.entries(expected) as Array<[
    'coverage' | 'unitTests' | 'e2eTests',
    boolean,
  ]>) {
    if (Boolean(options[key]) !== required) {
      throw new Error(`${stream}:invalid-${key}`);
    }
  }

  if (!options.baselines) {
    throw new Error(`${stream}:missing-baselines`);
  }
  if (options.writeBaseline && stream === 'frontend-e2e') {
    throw new Error(`${stream}:baseline-not-supported`);
  }
}

async function readJson(path: string, stream: QualityStream): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    throw new Error(`${stream}:invalid-json`);
  }
}

function isMinimums(value: unknown): value is CoverageMinimums {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return ['statements', 'branches', 'functions', 'lines'].every((metric) => {
    const minimum = (value as Record<string, unknown>)[metric];
    return typeof minimum === 'number' && Number.isFinite(minimum) && minimum >= 0;
  });
}

function parseBaselines(raw: unknown, stream: QualityStream): CoverageBaselineFile {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`${stream}:invalid-baselines`);
  }
  const baselines = raw as Record<string, unknown>;
  if (!isMinimums(baselines.backend)) {
    throw new Error(`${stream}:invalid-baselines`);
  }
  const frontend = baselines.frontend;
  if (frontend !== undefined && !isMinimums(frontend)) {
    throw new Error(`${stream}:invalid-baselines`);
  }
  if (frontend === undefined) {
    return { backend: baselines.backend as CoverageMinimums };
  }
  return {
    backend: baselines.backend as CoverageMinimums,
    frontend: frontend as CoverageMinimums,
  };
}

function coverageMinimums(report: CoverageReport): CoverageMinimums {
  return {
    statements: report.metrics.statements.pct,
    branches: report.metrics.branches.pct,
    functions: report.metrics.functions.pct,
    lines: report.metrics.lines.pct,
  };
}

function evaluateGate(
  report: Omit<QualityReport, 'gate'>,
  baselines: CoverageBaselineFile,
  allowMissingCoverageBaseline: boolean,
): QualityReport['gate'] {
  const reasons: string[] = [];
  if (report.coverage) {
    const baseline = report.stream === 'backend' ? baselines.backend : baselines.frontend;
    if (!baseline) {
      if (!allowMissingCoverageBaseline) {
        reasons.push('missing-coverage-baseline');
      }
    } else {
      reasons.push(
        ...evaluateCoverage(report.coverage, baseline).failures.map(
          (failure) => `coverage:${failure.metric}:${failure.actual}<${failure.required}`,
        ),
      );
    }
  }
  for (const [name, summary] of [
    ['unit-tests', report.unitTests],
    ['e2e-tests', report.e2eTests],
  ] as const) {
    if (summary) {
      reasons.push(...evaluateTestRun(summary).reasons.map((reason) => `${name}:${reason}`));
    }
  }
  return { passed: reasons.length === 0, reasons };
}

async function writeOutput(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}

export async function runQualityReportCli(arguments_: string[]): Promise<QualityReport> {
  let stream: QualityStream;
  try {
    const options = parseArguments(arguments_);
    stream = assertStream(options.stream);
    assertInputs(stream, options);

    const baselines = parseBaselines(await readJson(options.baselines!, stream), stream);
    const coverage = options.coverage
      ? parseCoverageSummary(
          await readJson(options.coverage, stream),
          stream === 'backend' ? 'backend' : 'frontend',
        )
      : undefined;
    const unitTests = options.unitTests
      ? parseJestStyleResults(await readJson(options.unitTests, stream))
      : undefined;
    const e2eTests = options.e2eTests
      ? stream === 'frontend-e2e'
        ? parsePlaywrightResults(await readJson(options.e2eTests, stream))
        : parseJestStyleResults(await readJson(options.e2eTests, stream))
      : undefined;
    const reportWithoutGate = {
      stream,
      generatedAt: new Date().toISOString(),
      toolVersions: { node: process.version },
      ...(coverage ? { coverage } : {}),
      ...(unitTests ? { unitTests } : {}),
      ...(e2eTests ? { e2eTests } : {}),
    };
    const report: QualityReport = {
      ...reportWithoutGate,
      gate: evaluateGate(reportWithoutGate, baselines, options.writeBaseline),
    };

    if (!options.checkOnly && options.writeBaseline && coverage && report.gate.passed) {
      const nextBaselines: CoverageBaselineFile = {
        ...baselines,
        ...(stream === 'backend'
          ? { backend: ratchetCoverageBaseline(baselines.backend, coverageMinimums(coverage)) }
          : { frontend: ratchetCoverageBaseline(baselines.frontend, coverageMinimums(coverage)) }),
      };
      await writeOutput(options.baselines!, `${JSON.stringify(nextBaselines, null, 2)}\n`);
    }

    if (!options.checkOnly) {
      const markdown = renderQualityMarkdown(report);
      if (options.markdown) {
        await writeOutput(options.markdown, `${markdown}\n`);
      }
      if (options.json) {
        await writeOutput(options.json, `${JSON.stringify(report, null, 2)}\n`);
      }
      if (process.env.GITHUB_STEP_SUMMARY) {
        await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
      }
    }
    if (!report.gate.passed) {
      throw new Error(`${stream}:quality-gate-failed:${report.gate.reasons.join(',')}`);
    }
    return report;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid-quality-report';
    if (typeof stream === 'string' && !message.startsWith(`${stream}:`)) {
      throw new Error(`${stream}:${message}`);
    }
    throw error;
  }
}

async function main(): Promise<void> {
  try {
    await runQualityReportCli(process.argv.slice(2));
  } catch (error) {
    process.exitCode = 1;
    process.stderr.write(`${error instanceof Error ? error.message : 'invalid-quality-report'}\n`);
  }
}

if (require.main === module) {
  void main();
}
