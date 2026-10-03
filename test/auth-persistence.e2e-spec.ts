import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { SchedulerRegistry } from '@nestjs/schedule';
import { setTimeout as delay } from 'node:timers/promises';
import { TokenSessionService } from '../src/auth/token-session.service';
import {
  AuthSubjectType,
  RefreshTokenFamilyModelName,
} from '../src/auth/schemas/refresh-token-family.schema';
import { deferred } from './support/backend-coverage-fixtures';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose, { Connection, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  MigrationConnection,
  loadMigrations,
  runPendingMigrations,
} from '../migrations/migrate';

const origin = 'http://localhost:5173';

function cookieHeader(headers: request.Response['headers']): string {
  const cookies = headers['set-cookie'];
  const first = Array.isArray(cookies) ? cookies[0] : cookies?.toString();
  return first?.split(';')[0] ?? '';
}

describe('Authentication persistence across application restarts (e2e)', () => {
  let replicaSet: MongoMemoryReplSet;
  let app: INestApplication;
  let previousMongoUri: string | undefined;
  let previousTrustedOrigins: string | undefined;

  async function createApp(): Promise<INestApplication> {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const nextApp = module.createNestApplication();
    nextApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await nextApp.init();
    return nextApp;
  }

  beforeAll(async () => {
    previousMongoUri = process.env.MONGODB_URI;
    previousTrustedOrigins = process.env.AUTH_TRUSTED_BROWSER_ORIGINS;
    process.env.AUTH_TRUSTED_BROWSER_ORIGINS = JSON.stringify([origin]);
    replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = replicaSet.getUri('auth-persistence');

    const connection = mongoose.createConnection(process.env.MONGODB_URI);
    await connection.asPromise();
    await seedAccounts(connection);
    await runPendingMigrations(
      connection as unknown as MigrationConnection,
      await loadMigrations(),
    );
    await connection.close();
    app = await createApp();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await replicaSet?.stop();
    if (previousMongoUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousMongoUri;
    if (previousTrustedOrigins === undefined) {
      delete process.env.AUTH_TRUSTED_BROWSER_ORIGINS;
    } else {
      process.env.AUTH_TRUSTED_BROWSER_ORIGINS = previousTrustedOrigins;
    }
  });

  it('closes Mongo and removes both workers timers when the application closes', async () => {
    const connection = app.get<Connection>(getConnectionToken());
    const registry = app.get(SchedulerRegistry);
    const sessions = app.get(TokenSessionService) as unknown as {
      reconciliationTimer?: NodeJS.Timeout;
    };
    const refreshTimer = sessions.reconciliationTimer;
    const identifierTimer = registry.getInterval(
      'auth-identifier-reconciliation',
    ) as NodeJS.Timeout;
    expect(connection.readyState).toBe(1);
    await app.close();
    expect(connection.readyState).toBe(0);
    expect(registry.getIntervals()).toEqual([]);
    expect(sessions.reconciliationTimer).toBeUndefined();
    expect(
      (refreshTimer as unknown as { _destroyed: boolean })._destroyed,
    ).toBe(true);
    expect(
      (identifierTimer as unknown as { _destroyed: boolean })._destroyed,
    ).toBe(true);
    app = await createApp();
  });

  it('drains an active refresh-marker recovery before closing Mongo', async () => {
    const service = app.get(TokenSessionService);
    const connection = app.get<Connection>(getConnectionToken());
    const created = await service.createFamily({
      clientId: 'web',
      subjectType: AuthSubjectType.Staff,
      subjectId: 'drain-fixture',
      scopes: ['catalog:read'],
      authVersion: 0,
      ttlSeconds: 600,
    });
    const operationId = 'drain-marker-operation';
    await connection.collection('refresh_token_replay_markers').insertOne({
      familyId: created.familyId,
      tokenHash: service.hashRefreshToken(created.refreshToken),
      rotationOperationId: operationId,
      status: 'pending',
      leaseExpiresAt: new Date(Date.now() - 1_000),
      expiresAt: created.expiresAt,
    });
    await connection.collection('refresh_token_families').updateOne(
      { familyId: created.familyId },
      {
        $set: {
          currentTokenHash: service.hashRefreshToken('unreturned-successor'),
          lastRotationOperationId: operationId,
        },
      },
    );
    const familyModel = app.get(getModelToken(RefreshTokenFamilyModelName));
    const originalFind = familyModel.findOne.bind(familyModel);
    const entered = deferred<void>();
    const release = deferred<void>();
    const gate = jest
      .spyOn(familyModel, 'findOne')
      .mockImplementationOnce((...args) => {
        const query = originalFind(...args);
        const execute = query.exec.bind(query);
        query.exec = async () => {
          entered.resolve();
          await release.promise;
          return execute();
        };
        return query;
      });
    const recovery = service.reconcileExpiredPendingMarkers();
    await entered.promise;
    const closing = app.close();
    try {
      expect(
        await Promise.race([
          closing.then(() => 'closed'),
          delay(100, 'draining'),
        ]),
      ).toBe('draining');
      expect(connection.readyState).toBe(1);
    } finally {
      release.resolve();
      await Promise.all([recovery, closing]);
      gate.mockRestore();
      app = await createApp();
    }
    const reopened = app.get<Connection>(getConnectionToken());
    expect(
      (
        await reopened
          .collection('refresh_token_families')
          .findOne({ familyId: created.familyId })
      ).status,
    ).toBe('revoked');
    const marker = await reopened
      .collection('refresh_token_replay_markers')
      .findOne({ familyId: created.familyId });
    expect(marker.status).toBe('committed');
    expect(marker.leaseExpiresAt).toBeUndefined();
  });

  it('recovers pre-CAS and orphaned markers across restarts and concurrent instances', async () => {
    let service = app.get(TokenSessionService);
    let connection = app.get<Connection>(getConnectionToken());
    const created = await service.createFamily({
      clientId: 'web',
      subjectType: AuthSubjectType.Staff,
      subjectId: 'lease-fixture',
      scopes: ['catalog:read'],
      authVersion: 0,
      ttlSeconds: 600,
    });
    const tokenHash = service.hashRefreshToken(created.refreshToken);
    await connection.collection('refresh_token_replay_markers').insertOne({
      familyId: created.familyId,
      tokenHash,
      rotationOperationId: 'interrupted-before-cas',
      status: 'pending',
      leaseExpiresAt: new Date(Date.now() + 30_000),
      expiresAt: created.expiresAt,
    });
    await app.close();
    app = await createApp();
    service = app.get(TokenSessionService);
    connection = app.get<Connection>(getConnectionToken());
    await expect(service.rotate(created.refreshToken)).rejects.toThrow(
      'Invalid refresh session',
    );
    expect(
      (
        await connection
          .collection('refresh_token_families')
          .findOne({ familyId: created.familyId })
      ).status,
    ).toBe('active');
    await connection
      .collection('refresh_token_replay_markers')
      .updateOne(
        { tokenHash },
        { $set: { leaseExpiresAt: new Date(Date.now() - 1_000) } },
      );
    const rotated = await service.rotate(created.refreshToken);
    expect(rotated.familyId).toBe(created.familyId);
    expect(
      await connection
        .collection('refresh_token_replay_markers')
        .countDocuments({ tokenHash }),
    ).toBe(1);
    const marker = await connection
      .collection('refresh_token_replay_markers')
      .findOne({ tokenHash });
    expect(marker.status).toBe('committed');
    expect(marker.rotationOperationId === 'interrupted-before-cas').toBe(false);

    // Simulate process loss after family CAS but before marker commit/response.
    await connection.collection('refresh_token_replay_markers').updateOne(
      { tokenHash },
      {
        $set: {
          status: 'pending',
          leaseExpiresAt: new Date(Date.now() - 1_000),
        },
        $unset: { committedAt: '' },
      },
    );
    await app.close();
    app = await createApp();
    const second = await createApp();
    try {
      await Promise.all([
        app.get(TokenSessionService).reconcileExpiredPendingMarkers(),
        second.get(TokenSessionService).reconcileExpiredPendingMarkers(),
      ]);
      connection = app.get<Connection>(getConnectionToken());
      expect(
        await connection
          .collection('refresh_token_replay_markers')
          .countDocuments({ tokenHash, status: 'committed' }),
      ).toBe(1);
      expect(
        (
          await connection
            .collection('refresh_token_families')
            .findOne({ familyId: created.familyId })
        ).status,
      ).toBe('revoked');
      await expect(
        app.get(TokenSessionService).rotate(rotated.refreshToken),
      ).rejects.toThrow('Invalid refresh session');
      await expect(
        second.get(TokenSessionService).rotate(created.refreshToken),
      ).rejects.toThrow('Invalid refresh session');
    } finally {
      await second.close();
      // Passport's process-global strategy points to the most recently created
      // TestingModule. Reopen the surviving HTTP fixture after closing its peer.
      await app.close();
      app = await createApp();
    }
  });

  it('preserves staff/member identity, scope, ownership, and refresh continuity', async () => {
    const staffLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', origin)
      .send({ identifier: 'admin@example.test', password: 'AdminPass#2026' })
      .expect(200);
    expect(staffLogin.body).toMatchObject({
      roleArea: 'staff',
      scope: expect.stringContaining('roles:manage'),
      user: { roles: ['admin'] },
    });
    const staffRefreshCookie = cookieHeader(staffLogin.headers);
    expect(staffRefreshCookie).toMatch(/^book_library_refresh=/);

    const memberLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', origin)
      .send({ identifier: 'M-1001', password: 'MemberPass#2026' })
      .expect(200);
    expect(memberLogin.body).toMatchObject({
      roleArea: 'member',
      scope: 'member:self:read',
      member: { id: expect.any(String), memberNumber: 'M-1001' },
    });

    await request(app.getHttpServer())
      .get('/members/me')
      .set('Authorization', `Bearer ${memberLogin.body.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ memberNumber: 'M-1001' });
      });

    await app.close();
    app = await createApp();

    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', staffRefreshCookie)
      .expect(200);
    expect(refreshed.body).toMatchObject({
      roleArea: 'staff',
      scope: expect.stringContaining('roles:manage'),
      user: { roles: ['admin'] },
    });

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          roleArea: 'staff',
          user: { roles: ['admin'] },
        });
      });

    await app.close();
    app = await createApp();
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', staffRefreshCookie)
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', cookieHeader(refreshed.headers))
      .expect(401);
    const connection = app.get<Connection>(getConnectionToken());
    await connection
      .collection('members')
      .updateOne({ memberNumber: 'M-1001' }, { $inc: { authVersion: 1 } });
    await app.close();
    app = await createApp();
    await request(app.getHttpServer())
      .get('/members/me')
      .set('Authorization', `Bearer ${memberLogin.body.accessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', cookieHeader(memberLogin.headers))
      .expect(401);
  }, 90_000);
});

async function seedAccounts(connection: Connection): Promise<void> {
  const now = new Date();
  const membershipTypeId = new Types.ObjectId();
  await connection.collection('membershiptypes').insertOne({
    _id: membershipTypeId,
    code: 'STANDARD',
    name: 'Standard',
    maxActiveLoans: 3,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
  await connection.collection('staffusers').insertOne({
    _id: new Types.ObjectId(),
    email: 'admin@example.test',
    displayName: 'Library Admin',
    passwordHash: await bcrypt.hash('AdminPass#2026', 10),
    roles: ['admin'],
    status: 'active',
    authVersion: 0,
    createdAt: now,
    updatedAt: now,
  });
  await connection.collection('members').insertOne({
    _id: new Types.ObjectId(),
    memberNumber: 'M-1001',
    fullName: 'Member One',
    email: 'member@example.test',
    loginIdentifier: 'member@example.test',
    membershipTypeId,
    status: 'active',
    authStatus: 'active',
    activeLoanCount: 0,
    authVersion: 0,
    passwordHash: await bcrypt.hash('MemberPass#2026', 10),
    createdAt: now,
    updatedAt: now,
  });
}
