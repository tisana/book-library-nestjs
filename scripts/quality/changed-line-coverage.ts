import { appendFile, readFile } from 'node:fs/promises';

export type ChangedLineCoverageStatus = 'passed' | 'failed' | 'not-applicable';
export type ChangedLineCoverageScope = 'backend' | 'frontend';

export interface ChangedCoverageGate {
  status: ChangedLineCoverageStatus;
  passed: boolean;
  pct: number;
  covered: number;
  total: number;
  missingFiles: string[];
  minimum: number;
}

function decodeGitPath(value: string): string {
  if (!value.startsWith('"')) {
    return value;
  }

  let decoded = '';
  for (let index = 1; index < value.length; index += 1) {
    const character = value[index];
    if (character === '"') {
      return decoded;
    }
    if (character !== '\\') {
      decoded += character;
      continue;
    }

    const escape = value[index + 1];
    if (escape === undefined) {
      return value;
    }
    const escapes: Record<string, string> = {
      '"': '"',
      '\\': '\\',
      a: '\x07',
      b: '\b',
      f: '\f',
      n: '\n',
      r: '\r',
      t: '\t',
      v: '\v',
    };
    if (escapes[escape] !== undefined) {
      decoded += escapes[escape];
      index += 1;
      continue;
    }
    const octal = value.slice(index + 1, index + 4).match(/^[0-7]{1,3}/)?.[0];
    if (octal) {
      decoded += String.fromCharCode(Number.parseInt(octal, 8));
      index += octal.length;
      continue;
    }
    return value;
  }
  return value;
}

function normalizePath(value: string): string {
  let normalized = decodeGitPath(value);
  if (!value.startsWith('"')) {
    normalized = normalized.replace(/\\/g, '/');
  }
  normalized = normalized.replace(/^\.\//, '').replace(/^(?:a|b)\//, '');
  const repositoryPath = normalized.match(/(?:^|\/)((?:frontend\/)?(?:src|test|scripts)\/.*)$/);
  if (repositoryPath) {
    normalized = repositoryPath[1];
  }
  return normalized;
}

export function parseChangedLines(unifiedDiff: string): Map<string, Set<number>> {
  const changed = new Map<string, Set<number>>();
  let path: string | undefined;
  let nextAddedLine: number | undefined;
  let awaitingNewFilePath = false;

  for (const line of unifiedDiff.split(/\r?\n/)) {
    if (line.startsWith('diff --git ')) {
      path = undefined;
      nextAddedLine = undefined;
      awaitingNewFilePath = false;
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      nextAddedLine = Number(hunk[1]);
      awaitingNewFilePath = false;
      continue;
    }
    if (nextAddedLine !== undefined) {
      if (!path) {
        continue;
      }
      if (line.startsWith('+')) {
        const lines = changed.get(path) ?? new Set<number>();
        lines.add(nextAddedLine);
        changed.set(path, lines);
        nextAddedLine += 1;
      } else if (!line.startsWith('-')) {
        nextAddedLine += 1;
      }
      continue;
    }
    if (line.startsWith('--- ')) {
      path = undefined;
      awaitingNewFilePath = true;
      continue;
    }
    if (awaitingNewFilePath && line.startsWith('+++ ')) {
      const candidate = line.slice(4);
      path = candidate === '/dev/null' ? undefined : normalizePath(candidate);
      awaitingNewFilePath = false;
    }
  }
  return changed;
}

export function parseLcov(raw: string): Map<string, Map<number, number>> {
  const lcov = new Map<string, Map<number, number>>();
  let path: string | undefined;

  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith('SF:')) {
      path = normalizePath(line.slice(3));
      if (!lcov.has(path)) {
        lcov.set(path, new Map<number, number>());
      }
      continue;
    }
    const record = line.match(/^DA:(\d+),(\d+)/);
    if (record && path) {
      lcov.get(path)!.set(Number(record[1]), Number(record[2]));
    }
    if (line === 'end_of_record') {
      path = undefined;
    }
  }
  return lcov;
}

export function filterChangedLines(
  changed: Map<string, Set<number>>,
  scope: ChangedLineCoverageScope,
): Map<string, Set<number>> {
  const prefix = scope === 'backend' ? 'src/' : 'frontend/src/';
  return new Map([...changed].filter(([path]) => path.startsWith(prefix)));
}

export function evaluateChangedLineCoverage(
  changed: Map<string, Set<number>>,
  lcov: Map<string, Map<number, number>>,
  minimum = 80,
): ChangedCoverageGate {
  if (!Number.isFinite(minimum) || minimum < 0 || minimum > 100) {
    throw new Error('invalid-changed-line-minimum');
  }
  if (changed.size === 0) {
    return {
      status: 'not-applicable',
      passed: true,
      pct: 100,
      covered: 0,
      total: 0,
      missingFiles: [],
      minimum,
    };
  }

  let covered = 0;
  let total = 0;
  const missingFiles: string[] = [];
  for (const [path, changedLines] of changed) {
    const lineHits = lcov.get(normalizePath(path));
    if (!lineHits) {
      missingFiles.push(path);
      total += changedLines.size;
      continue;
    }
    for (const line of changedLines) {
      const hits = lineHits.get(line);
      if (hits === undefined) {
        continue;
      }
      total += 1;
      if (hits > 0) {
        covered += 1;
      }
    }
  }
  const pct = total === 0 ? 100 : Math.floor((covered / total) * 10000) / 100;
  return {
    status: pct >= minimum && missingFiles.length === 0 ? 'passed' : 'failed',
    passed: pct >= minimum && missingFiles.length === 0,
    pct,
    covered,
    total,
    missingFiles,
    minimum,
  };
}

interface ChangedLineCoverageCliOptions {
  scope?: ChangedLineCoverageScope;
  diff?: string;
  lcov?: string;
  minimum: number;
}

function parseArguments(arguments_: string[]): ChangedLineCoverageCliOptions {
  const options: ChangedLineCoverageCliOptions = { minimum: 80 };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    const value = arguments_[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`invalid-changed-line-coverage:${argument}`);
    }
    if (argument === '--scope' && (value === 'backend' || value === 'frontend')) {
      options.scope = value;
    } else if (argument === '--diff') {
      options.diff = value;
    } else if (argument === '--lcov') {
      options.lcov = value;
    } else if (argument === '--minimum' && /^\d+(?:\.\d+)?$/.test(value)) {
      options.minimum = Number(value);
    } else {
      throw new Error(`invalid-changed-line-coverage:${argument}`);
    }
    index += 1;
  }
  if (!options.scope || !options.diff || !options.lcov) {
    throw new Error('invalid-changed-line-coverage:missing-input');
  }
  return options;
}

export async function runChangedLineCoverageCli(
  arguments_: string[],
): Promise<ChangedCoverageGate> {
  const options = parseArguments(arguments_);
  const [diff, rawLcov] = await Promise.all([
    readFile(options.diff!, 'utf8'),
    readFile(options.lcov!, 'utf8'),
  ]);
  const gate = evaluateChangedLineCoverage(
    filterChangedLines(parseChangedLines(diff), options.scope!),
    parseLcov(rawLcov),
    options.minimum,
  );
  const summary = `## ${options.scope} changed-line coverage\n\n| Status | Covered | Total | Coverage | Minimum |\n| --- | ---: | ---: | ---: | ---: |\n| ${gate.status} | ${gate.covered} | ${gate.total} | ${gate.pct.toFixed(2)}% | ${gate.minimum.toFixed(2)}% |\n`;
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  }
  process.stdout.write(`${JSON.stringify({ scope: options.scope, ...gate })}\n`);
  if (!gate.passed) {
    throw new Error(`${options.scope}:changed-line-coverage-gate-failed`);
  }
  return gate;
}

if (require.main === module) {
  runChangedLineCoverageCli(process.argv.slice(2)).catch((error: unknown) => {
    process.exitCode = 1;
    process.stderr.write(`${error instanceof Error ? error.message : 'invalid-changed-line-coverage'}\n`);
  });
}
