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

describe('authentication history preservation (e2e)', () => {
  let replicaSet: MongoMemoryReplSet;
  let app: INestApplication;
  let connection: Connection;
  let previousMongoUri: string | undefined;
  let previousTrustedOrigins: string | undefined;
  let ids: Awaited<ReturnType<typeof seedHistoryFixture>>;

  beforeAll(async () => {
    previousMongoUri = process.env.MONGODB_URI;
    previousTrustedOrigins = process.env.AUTH_TRUSTED_BROWSER_ORIGINS;
    process.env.AUTH_TRUSTED_BROWSER_ORIGINS = JSON.stringify([origin]);
    replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = replicaSet.getUri('auth-history-preservation');
    connection = mongoose.createConnection(process.env.MONGODB_URI);
    await connection.asPromise();
    ids = await seedHistoryFixture(connection);
    await runPendingMigrations(
      connection as unknown as MigrationConnection,
      await loadMigrations(),
    );

    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await connection?.close();
    await replicaSet?.stop();
    restoreEnv('MONGODB_URI', previousMongoUri);
    restoreEnv('AUTH_TRUSTED_BROWSER_ORIGINS', previousTrustedOrigins);
  });

  it('preserves account identity and historical references across role, status, and identifier changes', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', origin)
      .send({ identifier: 'admin@example.test', password: 'AdminPass#2026' })
      .expect(200);
    const authorization = `Bearer ${login.body.accessToken}`;

    await patch('/staff-users/' + ids.staffId, { roles: ['admin'] }, authorization);
    await patch('/staff-users/' + ids.staffId, { status: 'inactive' }, authorization);
    await patch('/staff-users/' + ids.staffId, { status: 'active' }, authorization);
    await patch(
      '/staff-users/' + ids.staffId,
      { email: 'corrected.staff@example.test' },
      authorization,
    );
    await patch('/members/' + ids.memberId, { status: 'suspended' }, authorization);
    await patch('/members/' + ids.memberId, { status: 'active' }, authorization);
    await patch(
      '/members/' + ids.memberId,
      { email: 'corrected.member@example.test' },
      authorization,
    );

    const staff = await connection.collection('staffusers').findOne({ _id: ids.staffObjectId });
    const member = await connection.collection('members').findOne({ _id: ids.memberObjectId });
    const borrowing = await connection.collection('borrowings').findOne({ _id: ids.borrowingId });
    const originalEvent = await connection
      .collection('security_activity_events')
      .findOne({ eventId: 'history-fixture-event' });
    const generatedEvents = await connection
      .collection('security_activity_events')
      .find({ targetId: { $in: [ids.staffId, ids.memberId] } })
      .toArray();

    expect(staff).toMatchObject({
      _id: ids.staffObjectId,
      email: 'corrected.staff@example.test',
      roles: ['admin'],
      status: 'active',
    });
    expect(member).toMatchObject({
      _id: ids.memberObjectId,
      email: 'corrected.member@example.test',
      status: 'active',
    });
    expect(borrowing).toMatchObject({
      _id: ids.borrowingId,
      memberId: ids.memberObjectId,
      borrowedByStaffId: ids.staffId,
      returnedByStaffId: ids.adminId,
    });
    expect(originalEvent).toMatchObject({
      actorId: ids.staffId,
      subjectId: ids.memberId,
      targetId: ids.borrowingId.toString(),
    });
    expect(generatedEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: 'role-changed', targetId: ids.staffId }),
        expect.objectContaining({ eventType: 'account-status-changed', targetId: ids.staffId }),
        expect.objectContaining({ eventType: 'account-status-changed', targetId: ids.memberId }),
        expect.objectContaining({
          eventType: 'identifier-reservation-recovered',
          targetId: ids.memberId,
        }),
      ]),
    );

    await expectIdentifier('staff@example.test', 'released', ids.staffId);
    await expectIdentifier('corrected.staff@example.test', 'active', ids.staffId);
    await expectIdentifier('history-member', 'active', ids.memberId);
    await expectIdentifier('corrected.member@example.test', 'active', ids.memberId);
  }, 90_000);

  async function patch(path: string, body: object, authorization: string) {
    await request(app.getHttpServer())
      .patch(path)
      .set('Authorization', authorization)
      .send(body)
      .expect(200);
  }

  async function expectIdentifier(
    normalizedIdentifier: string,
    status: string,
    subjectId: string,
  ) {
    await expect(
      connection.collection('auth_identifiers').findOne({ normalizedIdentifier }),
    ).resolves.toMatchObject({ status, subjectId });
  }
});

async function seedHistoryFixture(connection: Connection) {
  const now = new Date();
  const adminObjectId = new Types.ObjectId();
  const staffObjectId = new Types.ObjectId();
  const memberObjectId = new Types.ObjectId();
  const membershipTypeId = new Types.ObjectId();
  const borrowingId = new Types.ObjectId();
  const adminId = adminObjectId.toString();
  const staffId = staffObjectId.toString();
  const memberId = memberObjectId.toString();

  await connection.collection('membershiptypes').insertOne({
    _id: membershipTypeId,
    code: 'STANDARD',
    name: 'Standard',
    maxActiveLoans: 3,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
  await connection.collection('staffusers').insertMany([
    {
      _id: adminObjectId,
      email: 'admin@example.test',
      displayName: 'Library Admin',
      passwordHash: await bcrypt.hash('AdminPass#2026', 10),
      roles: ['admin'],
      status: 'active',
      authVersion: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: staffObjectId,
      email: 'staff@example.test',
      displayName: 'History Staff',
      passwordHash: await bcrypt.hash('StaffPass#2026', 10),
      roles: ['staff'],
      status: 'active',
      authVersion: 0,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  await connection.collection('members').insertOne({
    _id: memberObjectId,
    memberNumber: 'M-HISTORY',
    fullName: 'History Member',
    email: 'member@example.test',
    loginIdentifier: 'history-member',
    membershipTypeId,
    status: 'active',
    authStatus: 'active',
    activeLoanCount: 0,
    authVersion: 0,
    passwordHash: await bcrypt.hash('MemberPass#2026', 10),
    createdAt: now,
    updatedAt: now,
  });
  await connection.collection('borrowings').insertOne({
    _id: borrowingId,
    memberId: memberObjectId,
    bookId: new Types.ObjectId(),
    bookCategoryId: new Types.ObjectId(),
    borrowedAt: now,
    dueAt: new Date(now.getTime() + 86_400_000),
    returnedAt: now,
    status: 'returned',
    borrowedByStaffId: staffId,
    returnedByStaffId: adminId,
    createdAt: now,
    updatedAt: now,
  });
  await connection.collection('security_activity_events').insertOne({
    eventId: 'history-fixture-event',
    eventType: 'token-revoked',
    actorType: 'staff',
    actorId: staffId,
    targetType: 'borrowing',
    targetId: borrowingId.toString(),
    subjectType: 'member',
    subjectId: memberId,
    outcome: 'success',
    reasonCategory: 'history-fixture',
    createdAt: now,
  });

  return {
    adminId,
    staffId,
    memberId,
    adminObjectId,
    staffObjectId,
    memberObjectId,
    membershipTypeId,
    borrowingId,
  };
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
