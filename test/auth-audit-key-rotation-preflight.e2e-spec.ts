import {
  AuditKeyRotationPreflightContext,
  parseAuditKeyRotationPreflightInput,
  runAuditKeyRotationPreflight,
} from '../scripts/preflight-auth-audit-key-rotation';
import { AuthIdentifierRepairKeyPolicyService } from '../src/auth/auth-identifier-repair-key-policy.service';
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection } from 'mongoose';
import { AuthIdentifierOperationCollectionName } from '../src/auth/schemas/auth-identifier-operation.schema';
import { AuthThrottleBucketCollectionName } from '../src/auth/schemas/auth-throttle-bucket.schema';

interface SpawnResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

describe('audit correlation key rotation preflight process (e2e)', () => {
  jest.setTimeout(120000);

  let mongoServer: MongoMemoryServer;
  let connection: Connection;
  const currentSecret = Buffer.alloc(32, 4).toString('base64url');
  const previousOne = Buffer.alloc(32, 1).toString('base64url');
  const previousTwo = Buffer.alloc(32, 2).toString('base64url');

  const fixedFields = [
    'maxPreviousKeys',
    'requiredPreviousCount',
    'requiredPreviousVersions',
    'status',
  ];

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    connection = await mongoose
      .createConnection(mongoServer.getUri())
      .asPromise();
    await connection.createCollection(AuthIdentifierOperationCollectionName);
    await connection.createCollection(AuthThrottleBucketCollectionName);
    await connection
      .collection(AuthIdentifierOperationCollectionName)
      .createIndex(
        {
          operationType: 1,
          status: 1,
          cleanupStatus: 1,
          manifestKeyVersion: 1,
        },
        {
          partialFilterExpression: {
            operationType: 'offline-repair',
            manifestKeyVersion: { $exists: true },
          },
        },
      );
    await connection
      .collection(AuthThrottleBucketCollectionName)
      .createIndex({ keyVersion: 1, expiresAt: 1 });
  });

  afterAll(async () => {
    await connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      connection
        .collection(AuthIdentifierOperationCollectionName)
        .deleteMany({}),
      connection.collection(AuthThrottleBucketCollectionName).deleteMany({}),
    ]);
  });

  async function runProcess(input: string): Promise<SpawnResult> {
    const child = spawn(
      process.execPath,
      [
        '-r',
        'ts-node/register/transpile-only',
        '-r',
        'tsconfig-paths/register',
        path.join(
          process.cwd(),
          'scripts',
          'preflight-auth-audit-key-rotation.ts',
        ),
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'test',
          MONGODB_URI: mongoServer.getUri(),
          AUTH_AUDIT_CORRELATION_KEY_VERSION: '4',
          AUTH_AUDIT_CORRELATION_SECRET: currentSecret,
          AUTH_AUDIT_CORRELATION_PREVIOUS_KEYS: JSON.stringify({
            1: previousOne,
            2: previousTwo,
          }),
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => (stdout += chunk));
    child.stderr.on('data', (chunk: string) => (stderr += chunk));
    child.stdin.end(input);

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    return { exitCode, stdout, stderr };
  }

  it('runs as a process and returns exact allowed metadata with exit zero', async () => {
    const result = await runProcess(
      '{"candidateCurrentVersion":5,"candidatePreviousVersions":[4]}',
    );

    expect(result).toEqual({
      exitCode: 0,
      stderr: '',
      stdout: `${JSON.stringify({
        status: 'ok',
        requiredPreviousVersions: [4],
        requiredPreviousCount: 1,
        maxPreviousKeys: 2,
      })}\n`,
    });
  });

  it('blocks at process level with exit two and performs no data mutation', async () => {
    await connection
      .collection(AuthIdentifierOperationCollectionName)
      .insertOne({
        operationId: 'repair-1',
        operationType: 'offline-repair',
        status: 'pending',
        cleanupStatus: 'not-required',
        manifestKeyVersion: 1,
      });
    await connection.collection(AuthThrottleBucketCollectionName).insertOne({
      dimension: 'sign-in-source',
      keyVersion: 2,
      bucketKey: 'redacted-hmac',
      count: 1,
      windowStartedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const before = await Promise.all([
      connection
        .collection(AuthIdentifierOperationCollectionName)
        .find({})
        .toArray(),
      connection
        .collection(AuthThrottleBucketCollectionName)
        .find({})
        .toArray(),
    ]);

    const result = await runProcess(
      '{"candidateCurrentVersion":5,"candidatePreviousVersions":[4]}',
    );

    expect(result.stderr).toBe('');
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toEqual({
      status: 'blocked',
      reason: 'repair-key-rotation-blocked',
      requiredPreviousVersions: [1, 2, 4],
      requiredPreviousCount: 3,
      maxPreviousKeys: 2,
    });
    const after = await Promise.all([
      connection
        .collection(AuthIdentifierOperationCollectionName)
        .find({})
        .toArray(),
      connection
        .collection(AuthThrottleBucketCollectionName)
        .find({})
        .toArray(),
    ]);
    expect(after).toEqual(before);
  });

  it('rejects secret-bearing process input with exit one before MongoDB access', async () => {
    const result = await runProcess(
      '{"candidateCurrentVersion":5,"candidatePreviousVersions":[],"secret":"no"}',
    );

    expect(result.stderr).toBe('');
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual({
      status: 'error',
      reason: 'invalid-input',
      requiredPreviousVersions: [],
      requiredPreviousCount: 0,
      maxPreviousKeys: 2,
    });
  });

  it.each([
    '',
    '{}',
    '{"candidateCurrentVersion":0,"candidatePreviousVersions":[]}',
    '{"candidateCurrentVersion":3,"candidatePreviousVersions":[3]}',
    '{"candidateCurrentVersion":3,"candidatePreviousVersions":[1,1]}',
    '{"candidateCurrentVersion":3,"candidatePreviousVersions":[],"secret":"no"}',
    '{"candidateCurrentVersion":3,"candidatePreviousVersions":[],"unknown":true}',
  ])(
    'rejects invalid or secret-bearing metadata before startup',
    async (raw) => {
      const contextFactory = jest.fn();

      await expect(
        runAuditKeyRotationPreflight(raw, contextFactory),
      ).resolves.toEqual({
        exitCode: 1,
        output: {
          status: 'error',
          reason: 'invalid-input',
          requiredPreviousVersions: [],
          requiredPreviousCount: 0,
          maxPreviousKeys: 2,
        },
      });
      expect(contextFactory).not.toHaveBeenCalled();
    },
  );

  it('delegates allowed input and closes the application context', async () => {
    const preflightRotation = jest.fn().mockResolvedValue({
      status: 'ok',
      requiredPreviousVersions: [2, 3],
      requiredPreviousCount: 2,
      maxPreviousKeys: 2,
    });
    const close = jest.fn().mockResolvedValue(undefined);
    const contextFactory = jest.fn().mockResolvedValue({
      get: (type: unknown) => {
        expect(type).toBe(AuthIdentifierRepairKeyPolicyService);
        return { preflightRotation };
      },
      close,
    } satisfies AuditKeyRotationPreflightContext);

    const result = await runAuditKeyRotationPreflight(
      '{"candidateCurrentVersion":4,"candidatePreviousVersions":[3]}',
      contextFactory,
    );

    expect(preflightRotation).toHaveBeenCalledWith({
      candidateCurrentVersion: 4,
      candidatePreviousVersions: [3],
    });
    expect(result.exitCode).toBe(0);
    expect(Object.keys(result.output).sort()).toEqual(fixedFields);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('maps application-context cleanup failure to a redacted infrastructure error', async () => {
    const contextFactory = jest.fn().mockResolvedValue({
      get: () => ({
        preflightRotation: jest.fn().mockResolvedValue({
          status: 'ok',
          requiredPreviousVersions: [],
          requiredPreviousCount: 0,
          maxPreviousKeys: 2,
        }),
      }),
      close: jest.fn().mockRejectedValue(new Error('internal host secret')),
    } satisfies AuditKeyRotationPreflightContext);

    await expect(
      runAuditKeyRotationPreflight(
        '{"candidateCurrentVersion":4,"candidatePreviousVersions":[]}',
        contextFactory,
      ),
    ).resolves.toEqual({
      exitCode: 1,
      output: {
        status: 'error',
        reason: 'preflight-failed',
        requiredPreviousVersions: [],
        requiredPreviousCount: 0,
        maxPreviousKeys: 2,
      },
    });
  });

  it('returns exit code two at the two-key capacity boundary', async () => {
    const close = jest.fn().mockResolvedValue(undefined);
    const contextFactory = jest.fn().mockResolvedValue({
      get: () => ({
        preflightRotation: jest.fn().mockResolvedValue({
          status: 'blocked',
          reason: 'repair-key-rotation-blocked',
          requiredPreviousVersions: [1, 2, 3],
          requiredPreviousCount: 3,
          maxPreviousKeys: 2,
        }),
      }),
      close,
    } satisfies AuditKeyRotationPreflightContext);

    const result = await runAuditKeyRotationPreflight(
      '{"candidateCurrentVersion":4,"candidatePreviousVersions":[]}',
      contextFactory,
    );

    expect(result).toEqual({
      exitCode: 2,
      output: {
        status: 'blocked',
        reason: 'repair-key-rotation-blocked',
        requiredPreviousVersions: [1, 2, 3],
        requiredPreviousCount: 3,
        maxPreviousKeys: 2,
      },
    });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('redacts infrastructure failures and performs no adapter mutation', async () => {
    const close = jest.fn().mockResolvedValue(undefined);
    const update = jest.fn();
    const contextFactory = jest.fn().mockResolvedValue({
      get: () => ({
        preflightRotation: jest
          .fn()
          .mockRejectedValue(
            new Error('mongodb://user:password@internal/secret'),
          ),
        update,
      }),
      close,
    } satisfies AuditKeyRotationPreflightContext);

    const result = await runAuditKeyRotationPreflight(
      '{"candidateCurrentVersion":4,"candidatePreviousVersions":[]}',
      contextFactory,
    );

    expect(result).toEqual({
      exitCode: 1,
      output: {
        status: 'error',
        reason: 'preflight-failed',
        requiredPreviousVersions: [],
        requiredPreviousCount: 0,
        maxPreviousKeys: 2,
      },
    });
    expect(JSON.stringify(result)).not.toContain('mongodb');
    expect(JSON.stringify(result)).not.toContain('password');
    expect(update).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('accepts only positive, unique version metadata', () => {
    expect(
      parseAuditKeyRotationPreflightInput(
        '{"candidateCurrentVersion":7,"candidatePreviousVersions":[5,6]}',
      ),
    ).toEqual({
      candidateCurrentVersion: 7,
      candidatePreviousVersions: [5, 6],
    });
  });
});
