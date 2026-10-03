import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { JwtService } from '@nestjs/jwt';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose, { Connection, Types } from 'mongoose';
import { AuthPermission } from '../src/common/enums/auth-permission.enum';

describe('operational CLI processes on disposable MongoDB (e2e)', () => {
  jest.setTimeout(120000);
  const root = process.cwd();
  const password = randomBytes(32).toString('base64url');
  const jwtSecret = randomBytes(48).toString('base64url');
  const auditSecret = randomBytes(32).toString('base64url');
  const adminEmail = 'cli-administrator@example.test';
  let mongo: MongoMemoryReplSet;
  let connection: Connection;
  let directory: string;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'nest-operational-cli-'));
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    connection = await mongoose.createConnection(mongo.getUri()).asPromise();
    expect((await run('migrations/migrate.ts', ['up'])).code).toBe(0);
    expect((await run('scripts/bootstrap-admin.ts')).code).toBe(0);
  });

  afterAll(async () => {
    await connection?.close();
    await mongo?.stop();
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  async function run(
    file: string,
    args: string[] = [],
    input = '',
    extraEnvironment: NodeJS.ProcessEnv = {},
  ) {
    const child = spawn(
      process.execPath,
      [
        '-r',
        resolve(root, 'node_modules/ts-node/register'),
        '-r',
        resolve(root, 'node_modules/tsconfig-paths/register'),
        resolve(root, file),
        ...args,
      ],
      {
        cwd: directory,
        env: {
          ...process.env,
          TS_NODE_PROJECT: resolve(root, 'tsconfig.json'),
          NODE_ENV: 'test',
          MONGODB_URI: mongo.getUri(),
          JWT_SECRET: jwtSecret,
          JWT_ISSUER: 'operational-cli-test',
          JWT_AUDIENCE: 'book-library-api',
          AUTH_COOKIE_SECRET: randomBytes(48).toString('base64url'),
          AUTH_AUDIT_CORRELATION_SECRET: auditSecret,
          AUTH_AUDIT_CORRELATION_KEY_VERSION: '1',
          AUTH_AUDIT_CORRELATION_PREVIOUS_KEYS: '{}',
          AUTH_TRUSTED_PROXY_CIDRS: '[]',
          AUTH_TRUSTED_BROWSER_ORIGINS: '["http://localhost:5173"]',
          FIRST_ADMIN_EMAIL: adminEmail,
          FIRST_ADMIN_PASSWORD: password,
          ...extraEnvironment,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    const timeout = setTimeout(() => child.kill('SIGKILL'), 45000);
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => (stdout += chunk));
    child.stderr.on('data', (chunk: string) => (stderr += chunk));
    child.stdin.end(input);
    try {
      const code = await new Promise<number | null>((done, reject) => {
        child.once('error', reject);
        child.once('close', done);
      });
      // Report booleans so failure diagnostics cannot render disposable secrets.
      expect(
        [password, jwtSecret, auditSecret, mongo.getUri()].some((secret) =>
          `${stdout}${stderr}`.includes(secret),
        ),
      ).toBe(false);
      return { code, stdout, stderr };
    } finally {
      clearTimeout(timeout);
      if (child.exitCode === null && child.signalCode === null)
        child.kill('SIGKILL');
    }
  }

  it('loads source migrations, applies them once, and reports their exact states', async () => {
    const environment = { MONGODB_URI: mongo.getUri('migration_cli') };
    const initial = await run(
      'migrations/migrate.ts',
      ['status'],
      '',
      environment,
    );
    expect(initial.code).toBe(0);
    expect(initial.stdout.match(/: pending/g)).toHaveLength(4);
    const up = await run('migrations/migrate.ts', ['up'], '', environment);
    expect(up.code).toBe(0);
    expect(up.stdout.match(/Applied /g)).toHaveLength(4);
    const status = await run(
      'migrations/migrate.ts',
      ['status'],
      '',
      environment,
    );
    expect(status.code).toBe(0);
    expect(status.stdout.match(/: applied/g)).toHaveLength(4);
    const replay = await run('migrations/migrate.ts', ['up'], '', environment);
    expect(replay.code).toBe(0);
    expect(replay.stdout).toContain('No pending migrations.');
    expect(
      await connection
        .useDb('migration_cli')
        .collection('migration_records')
        .countDocuments(),
    ).toBe(4);
  });

  it('bootstraps one administrator with a hash, preserves idempotence and missing-input exit one', async () => {
    const environment = { MONGODB_URI: mongo.getUri('bootstrap_cli') };
    const first = await run('scripts/bootstrap-admin.ts', [], '', environment);
    expect(first.code).toBe(0);
    // Existing CLI contract includes the synthetic account address on creation.
    expect(first.stdout).toBe(`Created first administrator ${adminEmail}\n`);
    const second = await run('scripts/bootstrap-admin.ts', [], '', environment);
    expect(second.code).toBe(0);
    expect(second.stdout).toContain('Active administrator already exists');
    const accounts = await connection
      .useDb('bootstrap_cli')
      .collection('staffusers')
      .find({ roles: 'admin' })
      .toArray();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].passwordHash.startsWith('$2')).toBe(true);
    expect(accounts[0].passwordHash === password).toBe(false);
    const invalid = await run('scripts/bootstrap-admin.ts', [], '', {
      FIRST_ADMIN_PASSWORD: '',
    });
    expect(invalid.code).toBe(1);
    expect(invalid.stderr).toBe('FIRST_ADMIN_PASSWORD is required\n');
  });

  it('performs an authorized repair dry run from stdin and returns only safe metadata', async () => {
    const admin = await connection
      .collection('staffusers')
      .findOne({ email: adminEmail });
    const memberId = new Types.ObjectId().toString();
    const conflictId = new Types.ObjectId();
    await connection.collection('auth_identifiers').insertOne({
      _id: conflictId,
      normalizedIdentifier: 'cli-shared@example.test',
      identifierType: 'email',
      status: 'conflict',
      conflictResolutionStatus: 'manual-repair-required',
      conflictingSubjects: [
        { subjectType: 'staff', subjectId: admin._id.toString() },
        { subjectType: 'member', subjectId: memberId },
      ],
      createdBy: 'test',
      updatedBy: 'test',
    });
    const token = await new JwtService().signAsync(
      {
        sub: admin._id.toString(),
        role_area: 'staff',
        auth_version: 0,
        permissions: [AuthPermission.AuthIdentifiersManage],
      },
      {
        secret: jwtSecret,
        issuer: 'operational-cli-test',
        audience: 'book-library-api',
        expiresIn: 900,
      },
    );
    const newIdentifier = 'cli-replacement@example.test';
    const input = {
      action: 'dry-run',
      token,
      operationId: 'cli-dry-run',
      manifest: {
        conflictId: conflictId.toString(),
        retainedSubject: {
          subjectType: 'staff',
          subjectId: admin._id.toString(),
        },
        reassignments: [
          { subjectType: 'member', subjectId: memberId, newIdentifier },
        ],
      },
    };
    const result = await run(
      'scripts/resolve-auth-identifier-conflict.ts',
      [],
      JSON.stringify(input),
    );
    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(
      [token, newIdentifier, adminEmail].some((secret) =>
        result.stdout.includes(secret),
      ),
    ).toBe(false);
    expect(JSON.parse(result.stdout)).toEqual({
      status: 'ok',
      reason: 'identifier-offline-repair-pending',
      operationId: 'cli-dry-run',
      operationStatus: 'pending',
      assignmentCount: 1,
      batchCount: 1,
      replayed: false,
    });
    const operation = await connection
      .collection('auth_identifier_operations')
      .findOne({ operationId: 'cli-dry-run' });
    expect(operation.manifestHash).toEqual(expect.any(String));
    expect(JSON.stringify(operation).includes(newIdentifier)).toBe(false);
    const replay = await run(
      'scripts/resolve-auth-identifier-conflict.ts',
      [],
      JSON.stringify(input),
    );
    expect(replay.code).toBe(0);
    expect(JSON.parse(replay.stdout).replayed).toBe(true);
    expect(
      await connection
        .collection('auth_identifier_operations')
        .countDocuments({ operationId: 'cli-dry-run' }),
    ).toBe(1);
    // Pending operations are intentionally recovered during AppModule startup.
    // Isolate collision refusal with terminal work and no pending cleanup.
    await connection.collection('auth_identifier_operations').updateOne(
      { operationId: 'cli-dry-run' },
      {
        $set: {
          status: 'failed-terminal',
          cleanupStatus: 'not-required',
          terminalEventId: 'cli-terminal-fixture',
          terminalEventRecordedAt: new Date(),
        },
        $unset: { leaseOwner: '', leaseExpiresAt: '' },
      },
    );
    const beforeIdentifiers = await connection
      .collection('auth_identifiers')
      .find({})
      .sort({ _id: 1 })
      .toArray();
    const beforeOperations = await connection
      .collection('auth_identifier_operations')
      .countDocuments();
    const beforeCollision = await connection
      .collection('auth_identifier_operations')
      .findOne({ operationId: 'cli-dry-run' });
    const collision = await run(
      'scripts/resolve-auth-identifier-conflict.ts',
      [],
      JSON.stringify({
        ...input,
        manifest: {
          ...input.manifest,
          reassignments: [
            {
              subjectType: 'member',
              subjectId: memberId,
              newIdentifier: 'cli-other@example.test',
            },
          ],
        },
      }),
    );
    expect(collision.code).toBe(3);
    expect(collision.stderr).toBe('');
    expect(JSON.parse(collision.stdout)).toEqual({
      status: 'resumable',
      reason: 'repair-paused',
    });
    const afterCollision = await connection
      .collection('auth_identifier_operations')
      .findOne({ operationId: 'cli-dry-run' });
    expect(
      JSON.stringify(afterCollision) === JSON.stringify(beforeCollision),
    ).toBe(true);
    expect(
      await connection
        .collection('auth_identifier_operations')
        .countDocuments(),
    ).toBe(beforeOperations);
    expect(
      JSON.stringify(
        await connection
          .collection('auth_identifiers')
          .find({})
          .sort({ _id: 1 })
          .toArray(),
      ) === JSON.stringify(beforeIdentifiers),
    ).toBe(true);
  });

  it.each([
    ['malformed stdin', '{', 1, 'invalid', 'invalid-input'],
    [
      'unconfirmed apply',
      JSON.stringify({
        action: 'apply',
        token: 'stdin-only-token',
        operationId: 'refused-operation',
        manifest: {
          conflictId: 'conflict',
          reassignments: [
            {
              subjectType: 'member',
              subjectId: 'member',
              newIdentifier: 'private@example.test',
            },
          ],
        },
      }),
      2,
      'refused',
      'confirmation-required',
    ],
    [
      'unauthorized dry run',
      JSON.stringify({
        action: 'dry-run',
        token: 'stdin-only-token',
        operationId: 'denied-operation',
        manifest: {
          conflictId: 'conflict',
          reassignments: [
            {
              subjectType: 'member',
              subjectId: 'member',
              newIdentifier: 'private@example.test',
            },
          ],
        },
      }),
      4,
      'denied',
      'authorization-denied',
    ],
  ])(
    'keeps the repair process exit contract for %s',
    async (_name, input, code, status, reason) => {
      const result = await run(
        'scripts/resolve-auth-identifier-conflict.ts',
        [],
        input,
      );
      expect(result.code).toBe(code);
      expect(result.stderr).toBe('');
      expect(JSON.parse(result.stdout)).toEqual({ status, reason });
      expect(
        ['stdin-only-token', 'private@example.test'].some((secret) =>
          result.stdout.includes(secret),
        ),
      ).toBe(false);
    },
  );
});
