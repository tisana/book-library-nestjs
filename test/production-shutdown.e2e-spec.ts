import { randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as bcrypt from 'bcryptjs';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { Types } from 'mongoose';
import {
  loadMigrations,
  MigrationConnection,
  runPendingMigrations,
} from '../migrations/migrate';
import {
  createMongoTestContext,
  MongoTestContext,
} from './utils/mongo-test-setup';
import {
  ProductionProcess,
  productionShutdownBudgetMs,
  startProductionProcess,
} from './support/production-process';

const origin = 'https://shutdown.example.test';
const password = randomBytes(32).toString('base64url');
const environment = {
  NODE_ENV: 'production',
  JWT_ISSUER: 'shutdown-test',
  JWT_AUDIENCE: 'book-library-api',
  AUTH_AUDIT_CORRELATION_KEY_VERSION: '1',
  JWT_SECRET: randomBytes(48).toString('base64url'),
  AUTH_COOKIE_SECRET: randomBytes(48).toString('base64url'),
  AUTH_AUDIT_CORRELATION_SECRET: randomBytes(32).toString('base64url'),
  AUTH_TRUSTED_BROWSER_ORIGINS: JSON.stringify([origin]),
  AUTH_IDENTIFIER_RECONCILIATION_INTERVAL_SECONDS: '1',
};

// Mongo's test-only failpoint pauses actual child database commands. No altered
// entry point, application hooks, diagnostic routes, or production test switches.
describe('Compiled HTTP application SIGTERM shutdown', () => {
  let mongo: MongoMemoryReplSet;
  let context: MongoTestContext;
  let child: ProductionProcess | undefined;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      instanceOpts: [{ args: ['--setParameter', 'enableTestCommands=1'] }],
    });
    context = await createMongoTestContext(mongo.getUri('production-shutdown'));
    await context.connection.collection('staffusers').insertOne({
      email: 'shutdown@example.test',
      displayName: 'Synthetic shutdown account',
      passwordHash: await bcrypt.hash(password, 10),
      roles: ['staff'],
      status: 'active',
      authVersion: 0,
    });
    await runPendingMigrations(
      context.connection as unknown as MigrationConnection,
      await loadMigrations(),
    );
  });

  beforeEach(async () => {
    await context.connection
      .collection('auth_identifier_operations')
      .deleteMany({});
    child = await startProductionProcess({
      entryPath: resolve(__dirname, '../dist/main.js'),
      mongoUri: `${context.uri}&appName=shutdown-child`,
      environment,
    });
  });

  afterEach(async () => {
    await context.connection.db
      .admin()
      .command({ configureFailPoint: 'failCommand', mode: 'off' });
    await child?.stop();
    child = undefined;
  });

  afterAll(async () => {
    await context?.disconnect();
    await mongo?.stop();
  });

  async function blockNext(
    command: string,
    blockTimeMS = 1_500,
    errorCode?: number,
  ): Promise<number> {
    const configured = await context.connection.db.admin().command({
      configureFailPoint: 'failCommand',
      mode: { times: 1 },
      data: {
        failCommands: [command],
        appName: 'shutdown-child',
        blockConnection: true,
        blockTimeMS,
        ...(errorCode ? { errorCode } : {}),
      },
    });
    return configured.count + 1;
  }

  async function entered(timesEntered: number): Promise<void> {
    await context.connection.db.admin().command({
      waitForFailPoint: 'failCommand',
      timesEntered,
      maxTimeMS: 5_000,
    });
  }

  async function stopWithinBudget(): Promise<void> {
    const start = performance.now();
    expect(await child.stop()).toEqual({ code: null, signal: 'SIGTERM' });
    expect(performance.now() - start).toBeLessThan(productionShutdownBudgetMs);
  }

  async function seedFinalizing(operationId: string): Promise<void> {
    const reservationId = new Types.ObjectId();
    await context.connection.collection('auth_identifiers').insertOne({
      _id: reservationId,
      normalizedIdentifier: `${operationId}@example.test`,
      subjectType: 'staff',
      subjectId: 'synthetic-staff',
      identifierType: 'email',
      status: 'active',
      lastOperationId: operationId,
      createdBy: 'synthetic-staff',
      updatedBy: 'synthetic-staff',
    });
    await context.connection
      .collection('auth_identifier_operations')
      .insertOne({
        operationId: operationId,
        operationType: 'claim',
        status: 'finalizing',
        assignments: [
          {
            assignmentId: 'shutdown-assignment',
            subjectType: 'staff',
            subjectId: 'synthetic-staff',
            action: 'claim',
            status: 'applied',
            targetReservationId: reservationId,
          },
        ],
        cleanupStatus: 'not-required',
        requestedBy: { subjectType: 'staff', subjectId: 'synthetic-staff' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
  }

  it('exits within the deployment budget and makes shutdown idempotent', async () => {
    await stopWithinBudget();
    expect(await child.stop()).toEqual(await child.exited);
  });

  it('finishes an accepted database-backed login before signal shutdown', async () => {
    // The worker only uses findAndModify to claim; pause login's throttle update.
    const count = await blockNext('findAndModify');
    const response = request(child.baseUrl)
      .post('/auth/login')
      .set('Origin', origin)
      .send({ identifier: 'shutdown@example.test', password })
      .then(
        (value) => ({ status: value.status }),
        () => ({ status: 0 }),
      );
    await entered(count);
    const stopping = stopWithinBudget();
    expect((await response).status).toBe(200);
    await stopping;
    expect(
      await context.connection
        .collection('refresh_token_families')
        .countDocuments({ status: 'active' }),
    ).toBe(1);
  });

  it('closes after an active worker query fails and recovers the operation on restart', async () => {
    const count = await blockNext('findAndModify', 1_500, 2);
    await seedFinalizing('failed-query-recovery');
    await entered(count);
    await stopWithinBudget();
    const operations = context.connection.collection(
      'auth_identifier_operations',
    );
    expect(
      (await operations.findOne({ operationId: 'failed-query-recovery' }))
        .status,
    ).toBe('finalizing');
    child = await startProductionProcess({
      entryPath: resolve(__dirname, '../dist/main.js'),
      mongoUri: `${context.uri}&appName=shutdown-child`,
      environment,
    });
    expect(
      (await operations.findOne({ operationId: 'failed-query-recovery' }))
        .status,
    ).toBe('completed');
    expect(
      await context.connection
        .collection('security_activity_events')
        .countDocuments({ operationId: 'failed-query-recovery' }),
    ).toBe(1);
  });

  it('rejects a real worker budget overrun and recovers its interrupted lease after restart', async () => {
    // Pause terminal audit after the lease has been durably claimed.
    const count = await blockNext('update', productionShutdownBudgetMs + 2_000);
    await seedFinalizing('budget-overrun-recovery');
    await entered(count);
    const interrupted = child;
    child = undefined;
    await expect(interrupted.stop()).rejects.toThrow(
      `SIGTERM shutdown exceeded ${productionShutdownBudgetMs}ms`,
    );
    expect(await interrupted.exited).toEqual({ code: null, signal: 'SIGKILL' });
    const operations = context.connection.collection(
      'auth_identifier_operations',
    );
    const checkpoint = await operations.findOne({
      operationId: 'budget-overrun-recovery',
    });
    expect(checkpoint.status).toBe('finalizing');
    expect(checkpoint.leaseExpiresAt.getTime()).toBeGreaterThan(Date.now());
    // Advance this disposable lease past expiry instead of waiting the default
    // 300 seconds; the restarted worker still uses its real Mongo time predicate.
    await operations.updateOne(
      { operationId: checkpoint.operationId },
      { $set: { leaseExpiresAt: new Date(Date.now() - 6_000) } },
    );
    child = await startProductionProcess({
      entryPath: resolve(__dirname, '../dist/main.js'),
      mongoUri: `${context.uri}&appName=shutdown-child`,
      environment,
    });
    expect(
      (await operations.findOne({ operationId: checkpoint.operationId }))
        .status,
    ).toBe('completed');
    expect(
      await context.connection
        .collection('security_activity_events')
        .countDocuments({ operationId: checkpoint.operationId }),
    ).toBe(1);
    await stopWithinBudget();
  });

  it('finishes a claimed reconciliation pass before closing its database', async () => {
    const count = await blockNext('findAndModify');
    await seedFinalizing('shutdown-reconciliation');
    await entered(count);
    await stopWithinBudget();
    const operation = await context.connection
      .collection('auth_identifier_operations')
      .findOne({ operationId: 'shutdown-reconciliation' });
    expect(operation.status).toBe('completed');
    expect(operation.terminalEventId).toEqual(expect.any(String));
    expect(
      await context.connection
        .collection('security_activity_events')
        .countDocuments({ operationId: operation.operationId }),
    ).toBe(1);
    expect(operation.leaseExpiresAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(child.diagnostics()).not.toMatch(
      /reconciliation operation failed|MongoNotConnectedError|MongoClientClosedError/,
    );
  });
});

it('fails a shutdown deadline even when forced cleanup successfully removes a wedged child', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'shutdown-deadline-'));
  const entry = join(directory, 'wedged.cjs');
  await writeFile(
    entry,
    `
    require('node:http').createServer((_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'ok' }));
    }).listen(process.env.PORT);
    process.on('SIGTERM', () => {});
  `,
  );
  let process: ProductionProcess | undefined;
  try {
    process = await startProductionProcess({
      entryPath: entry,
      mongoUri: 'mongodb://127.0.0.1/disposable-unused',
      environment: {},
      shutdownTimeoutMs: 100,
    });
    await expect(process.stop()).rejects.toThrow(
      'SIGTERM shutdown exceeded 100ms',
    );
    expect(await process.exited).toEqual({ code: null, signal: 'SIGKILL' });
  } finally {
    await process?.stop().catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
  }
});
