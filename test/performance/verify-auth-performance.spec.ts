import {
  nearestRankPercentile,
  renderPerformanceEvidence,
  summarizeDurations,
} from '../../scripts/verify-auth-performance';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);

describe('compiled authentication performance runner', () => {
  it('completes concurrent requests against its own disposable HTTP listener', async () => {
    const repositoryRoot = resolve(__dirname, '../..');
    const outputDirectory = await mkdtemp(
      join(tmpdir(), 'auth-benchmark-regression-'),
    );
    try {
      await execute(
        process.execPath,
        [
          join(repositoryRoot, 'node_modules/typescript/bin/tsc'),
          '-p',
          join(repositoryRoot, 'tsconfig.performance.json'),
          '--outDir',
          outputDirectory,
        ],
        { cwd: repositoryRoot, timeout: 60_000 },
      );
      const outcome = await execute(
        process.execPath,
        [join(outputDirectory, 'scripts/verify-auth-performance.js')],
        {
          cwd: outputDirectory,
          env: {
            ...process.env,
            NODE_PATH: join(repositoryRoot, 'node_modules'),
          },
          timeout: 90_000,
        },
      ).then(
        (result) => ({ exitCode: 0, stderr: result.stderr }),
        (error) => ({ exitCode: error.code, stderr: error.stderr }),
      );
      expect(outcome.stderr).not.toContain('ECONNRESET');
      expect(outcome.exitCode).toBe(0);
      const evidence = await readFile(
        join(
          outputDirectory,
          'specs/003-auth-roles-permissions/evidence/auth-performance.md',
        ),
        'utf8',
      );
      expect(evidence).toContain('| Warm-ups per handler | 100 |');
      expect(evidence).toContain('| Measured requests per handler | 500 |');
      expect(evidence).toContain('| Concurrency | 10 |');
      expect(evidence).toContain(
        '| Authentication boundary p95 <= 50 ms | PASS |',
      );
      expect(evidence).toContain(
        '| First 50 of 10,000 security events <= 2,000 ms | PASS |',
      );
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  }, 180_000);
});

describe('authentication performance evidence helpers', () => {
  it('uses nearest-rank percentiles without interpolation', () => {
    expect(nearestRankPercentile([9, 1, 5, 3, 7], 0.5)).toBe(5);
    expect(nearestRankPercentile([1, 2, 3, 4, 5], 0.95)).toBe(5);
    expect(nearestRankPercentile([1, 2, 3, 4, 100], 0.8)).toBe(4);
  });

  it('summarizes p50, p95, and maximum from one sample set', () => {
    expect(summarizeDurations([1, 2, 3, 4, 100])).toEqual({
      p50Ms: 3,
      p95Ms: 100,
      maxMs: 100,
    });
  });

  it('renders fixed benchmark parameters, runtime metadata, and pass gates', () => {
    const markdown = renderPerformanceEvidence({
      generatedAt: '2026-07-18T00:00:00.000Z',
      nodeVersion: 'v24.0.0',
      mongoVersion: '8.0.0',
      cpuDescription: 'Test CPU',
      cpuCount: 8,
      warmupCount: 100,
      sampleCount: 500,
      concurrency: 10,
      securityEventCount: 10_000,
      baseline: { p50Ms: 1, p95Ms: 2, maxMs: 3 },
      protected: { p50Ms: 4, p95Ms: 5, maxMs: 6 },
      overhead: { p50Ms: 3, p95Ms: 4, maxMs: 5 },
      securityActivityFirst50Ms: 20,
      boundaryP95LimitMs: 50,
      securityActivityLimitMs: 2_000,
    });

    expect(markdown).toContain('Production-build Authentication Performance Evidence');
    expect(markdown).toContain('| Warm-ups per handler | 100 |');
    expect(markdown).toContain('| Measured requests per handler | 500 |');
    expect(markdown).toContain('| Concurrency | 10 |');
    expect(markdown).toContain('| Authentication boundary p95 <= 50 ms | PASS |');
    expect(markdown).toContain('| First 50 of 10,000 security events <= 2,000 ms | PASS |');
  });
});
