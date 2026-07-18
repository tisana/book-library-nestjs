import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose, { Connection, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as request from 'supertest';
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
