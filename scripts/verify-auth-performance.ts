import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose, { Connection, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as request from 'supertest';
import {
  MigrationConnection,
  loadMigrations,
  runPendingMigrations,
} from '../migrations/migrate';
import { AuthBenchmarkModule } from '../test/performance/auth-benchmark.module';

const warmupCount = 100;
const sampleCount = 500;
const concurrency = 10;
const securityEventCount = 10_000;
const boundaryP95LimitMs = 50;
const securityActivityLimitMs = 2_000;
const trustedOrigin = 'https://library.example.test';
const evidencePath = resolve(
  process.cwd(),
  'specs',
  '003-auth-roles-permissions',
  'evidence',
  'auth-performance.md',
);

export interface DurationSummary {
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
}

export interface PerformanceEvidence {
  generatedAt: string;
  nodeVersion: string;
  mongoVersion: string;
  cpuDescription: string;
  cpuCount: number;
  warmupCount: number;
  sampleCount: number;
  concurrency: number;
  securityEventCount: number;
  baseline: DurationSummary;
  protected: DurationSummary;
  overhead: DurationSummary;
  securityActivityFirst50Ms: number;
  boundaryP95LimitMs: number;
  securityActivityLimitMs: number;
}

export function nearestRankPercentile(
  samples: readonly number[],
  percentile: number,
): number {
  if (samples.length === 0) throw new Error('At least one sample is required');
  if (percentile <= 0 || percentile > 1) {
    throw new Error('Percentile must be greater than 0 and no more than 1');
  }
  const ordered = [...samples].sort((left, right) => left - right);
  const index = Math.ceil(percentile * ordered.length) - 1;
  return ordered[index];
}

export function summarizeDurations(samples: readonly number[]): DurationSummary {
  return {
    p50Ms: nearestRankPercentile(samples, 0.5),
    p95Ms: nearestRankPercentile(samples, 0.95),
    maxMs: Math.max(...samples),
  };
}

export function renderPerformanceEvidence(result: PerformanceEvidence): string {
  const boundaryPassed = result.overhead.p95Ms <= result.boundaryP95LimitMs;
  const activityPassed =
    result.securityActivityFirst50Ms <= result.securityActivityLimitMs;
  return `# Production-build Authentication Performance Evidence

Generated: ${result.generatedAt}

## Runtime

| Item | Value |
| --- | ---: |
| Node.js | ${result.nodeVersion} |
| MongoDB | ${result.mongoVersion} |
| CPU | ${result.cpuDescription} |
| Logical CPU count | ${result.cpuCount} |
| Warm-ups per handler | ${result.warmupCount} |
| Measured requests per handler | ${result.sampleCount} |
| Concurrency | ${result.concurrency} |
| Seeded security events | ${result.securityEventCount} |

The runner used a dedicated temporary MongoDB replica set, a separately compiled production-mode benchmark module, disabled Nest logging, equivalent response bodies, and nearest-rank percentiles. Authentication overhead samples are the non-negative protected duration minus the baseline duration at the same sample index.

## Results

| Measurement | p50 (ms) | p95 (ms) | max (ms) |
| --- | ---: | ---: | ---: |
| Unprotected baseline | ${formatMs(result.baseline.p50Ms)} | ${formatMs(result.baseline.p95Ms)} | ${formatMs(result.baseline.maxMs)} |
| Protected handler | ${formatMs(result.protected.p50Ms)} | ${formatMs(result.protected.p95Ms)} | ${formatMs(result.protected.maxMs)} |
| Authentication boundary overhead | ${formatMs(result.overhead.p50Ms)} | ${formatMs(result.overhead.p95Ms)} | ${formatMs(result.overhead.maxMs)} |

First 50 security events from a ${result.securityEventCount.toLocaleString('en-US')}-event dataset: ${formatMs(result.securityActivityFirst50Ms)} ms.

## Gates

| Gate | Result |
| --- | --- |
| Authentication boundary p95 <= ${result.boundaryP95LimitMs} ms | ${boundaryPassed ? 'PASS' : 'FAIL'} |
| First 50 of ${result.securityEventCount.toLocaleString('en-US')} security events <= ${result.securityActivityLimitMs.toLocaleString('en-US')} ms | ${activityPassed ? 'PASS' : 'FAIL'} |
`;
}

async function runBenchmark(): Promise<PerformanceEvidence> {
  const previousEnvironment = captureEnvironment();
  const replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replicaSet.getUri('auth-performance');
  configureBenchmarkEnvironment(uri);
  const seedConnection = mongoose.createConnection(uri, {
    directConnection: true,
    serverSelectionTimeoutMS: 5_000,
  });
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;

  try {
    await seedConnection.asPromise();
    await seedBenchmarkDatabase(seedConnection);
    await runPendingMigrations(
      seedConnection as unknown as MigrationConnection,
      await loadMigrations(),
    );
    await seedSecurityEvents(seedConnection, securityEventCount);
    const serverStatus = await seedConnection.db.admin().serverStatus();

    app = await NestFactory.create(AuthBenchmarkModule, { logger: false });
    await app.init();
    const server = app.getHttpServer();
    const login = await request(server)
      .post('/auth/login')
      .set('Origin', trustedOrigin)
      .send({ identifier: 'benchmark-admin@example.test', password: 'BenchmarkPass#2026' })
      .expect(200);
    const authorization = `Bearer ${login.body.accessToken}`;

    await measureRequests(server, '/__test/auth-benchmark/unprotected', warmupCount);
    await measureRequests(
      server,
      '/__test/auth-benchmark/protected',
      warmupCount,
      authorization,
    );
    const baselineSamples = await measureRequests(
      server,
      '/__test/auth-benchmark/unprotected',
      sampleCount,
    );
    const protectedSamples = await measureRequests(
      server,
      '/__test/auth-benchmark/protected',
      sampleCount,
      authorization,
    );
    const overheadSamples = protectedSamples.map((duration, index) =>
      Math.max(0, duration - baselineSamples[index]),
    );

    const activityStartedAt = process.hrtime.bigint();
    const activityResponse = await request(server)
      .get('/auth/security-activity?limit=50')
      .set('Authorization', authorization)
      .expect(200);
    const securityActivityFirst50Ms = elapsedMs(activityStartedAt);
    if (activityResponse.body.items?.length !== 50) {
      throw new Error('Security activity benchmark did not return 50 events');
    }

    const cpu = cpus();
    return {
      generatedAt: new Date().toISOString(),
      nodeVersion: process.version,
      mongoVersion: String(serverStatus.version),
      cpuDescription: cpu[0]?.model ?? 'unknown',
      cpuCount: cpu.length,
      warmupCount,
      sampleCount,
      concurrency,
      securityEventCount,
      baseline: summarizeDurations(baselineSamples),
      protected: summarizeDurations(protectedSamples),
      overhead: summarizeDurations(overheadSamples),
      securityActivityFirst50Ms,
      boundaryP95LimitMs,
      securityActivityLimitMs,
    };
  } finally {
    await app?.close();
    await seedConnection.close();
    await replicaSet.stop();
    restoreEnvironment(previousEnvironment);
  }
}

async function measureRequests(
  server: Parameters<typeof request>[0],
  path: string,
  count: number,
  authorization?: string,
): Promise<number[]> {
  const durations = new Array<number>(count);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, count) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= count) return;
      const startedAt = process.hrtime.bigint();
      const pending = request(server).get(path);
      if (authorization) pending.set('Authorization', authorization);
      await pending.expect(200);
      durations[index] = elapsedMs(startedAt);
    }
  });
  await Promise.all(workers);
  return durations;
}

async function seedBenchmarkDatabase(connection: Connection): Promise<void> {
  const now = new Date();
  await connection.collection('staffusers').insertOne({
    _id: new Types.ObjectId(),
    email: 'benchmark-admin@example.test',
    displayName: 'Benchmark Admin',
    passwordHash: await bcrypt.hash('BenchmarkPass#2026', 10),
    roles: ['admin'],
    status: 'active',
    authVersion: 0,
    createdAt: now,
    updatedAt: now,
  });
}

async function seedSecurityEvents(
  connection: Connection,
  count: number,
): Promise<void> {
  const collection = connection.collection('security_activity_events');
  for (let offset = 0; offset < count; offset += 1_000) {
    const batchSize = Math.min(1_000, count - offset);
    await collection.insertMany(
      Array.from({ length: batchSize }, (_, index) => ({
        eventId: `benchmark-event-${offset + index}`,
        eventType: 'authorization-denied',
        actorType: 'system',
        outcome: 'denied',
        reasonCategory: 'benchmark-fixture',
        createdAt: new Date(Date.now() - (offset + index) * 1_000),
      })),
    );
  }
}

function configureBenchmarkEnvironment(uri: string): void {
  process.env.NODE_ENV = 'production';
  process.env.MONGODB_URI = uri;
  process.env.JWT_ISSUER = 'book-library-performance';
  process.env.JWT_AUDIENCE = 'book-library-api';
  process.env.JWT_SECRET = randomBytes(48).toString('base64url');
  process.env.AUTH_COOKIE_SECRET = randomBytes(48).toString('base64url');
  process.env.AUTH_AUDIT_CORRELATION_SECRET = randomBytes(32).toString('base64url');
  process.env.AUTH_AUDIT_CORRELATION_KEY_VERSION = '1';
  process.env.AUTH_AUDIT_CORRELATION_PREVIOUS_KEYS = '{}';
  process.env.AUTH_TRUSTED_BROWSER_ORIGINS = JSON.stringify([trustedOrigin]);
  process.env.AUTH_TRUSTED_PROXY_CIDRS = '[]';
}

const benchmarkEnvironmentNames = [
  'NODE_ENV',
  'MONGODB_URI',
  'JWT_ISSUER',
  'JWT_AUDIENCE',
  'JWT_SECRET',
  'AUTH_COOKIE_SECRET',
  'AUTH_AUDIT_CORRELATION_SECRET',
  'AUTH_AUDIT_CORRELATION_KEY_VERSION',
  'AUTH_AUDIT_CORRELATION_PREVIOUS_KEYS',
  'AUTH_TRUSTED_BROWSER_ORIGINS',
  'AUTH_TRUSTED_PROXY_CIDRS',
] as const;

function captureEnvironment(): Record<string, string | undefined> {
  return Object.fromEntries(
    benchmarkEnvironmentNames.map((name) => [name, process.env[name]]),
  );
}

function restoreEnvironment(values: Record<string, string | undefined>): void {
  for (const name of benchmarkEnvironmentNames) {
    const value = values[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

function elapsedMs(startedAt: bigint): number {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

function formatMs(value: number): string {
  return value.toFixed(2);
}

async function main(): Promise<void> {
  const result = await runBenchmark();
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, renderPerformanceEvidence(result), 'utf8');
  const passed =
    result.overhead.p95Ms <= result.boundaryP95LimitMs &&
    result.securityActivityFirst50Ms <= result.securityActivityLimitMs;
  console.log(
    `auth-boundary-p95-ms=${formatMs(result.overhead.p95Ms)} security-activity-first-50-ms=${formatMs(result.securityActivityFirst50Ms)} evidence=${evidencePath}`,
  );
  if (!passed) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error: Error) => {
    console.error(`auth-performance-verification-failed: ${error.message}`);
    process.exitCode = 1;
  });
}
