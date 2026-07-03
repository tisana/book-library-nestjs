import * as bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection } from 'mongoose';

import {
  bootstrapFirstAdministrator,
  readBootstrapAdminOptions,
} from '../scripts/bootstrap-admin';

describe('bootstrap first administrator (e2e)', () => {
  jest.setTimeout(120000);

  let mongoServer: MongoMemoryServer;
  let connection: Connection;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    connection = await mongoose
      .createConnection(mongoServer.getUri())
      .asPromise();
  });

  afterAll(async () => {
    await connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await connection.collection('staffusers').deleteMany({});
  });

  it('creates one active administrator with a hashed password', async () => {
    const result = await bootstrapFirstAdministrator(
      {
        mongoUri: mongoServer.getUri(),
        email: 'Admin@Example.Test',
        displayName: 'First Admin',
        password: 'UniqueAdminPass123!',
      },
      connection,
    );

    expect(result).toEqual({
      created: true,
      email: 'admin@example.test',
    });

    const admins = await connection
      .collection('staffusers')
      .find({ status: 'active', roles: 'admin' })
      .toArray();

    expect(admins).toHaveLength(1);
    expect(admins[0]).toMatchObject({
      email: 'admin@example.test',
      displayName: 'First Admin',
      roles: ['admin'],
      status: 'active',
      authVersion: 0,
    });
    expect(admins[0]).not.toHaveProperty('password');
    expect(admins[0].passwordHash).not.toBe('UniqueAdminPass123!');
    await expect(
      bcrypt.compare('UniqueAdminPass123!', admins[0].passwordHash),
    ).resolves.toBe(true);
  });

  it('does not create another administrator when an active admin exists', async () => {
    await connection.collection('staffusers').insertOne({
      email: 'existing-admin@example.test',
      displayName: 'Existing Admin',
      passwordHash: await bcrypt.hash('ExistingAdminPass123!', 12),
      roles: ['admin'],
      status: 'active',
      authVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await bootstrapFirstAdministrator(
      {
        mongoUri: mongoServer.getUri(),
        email: 'new-admin@example.test',
        displayName: 'New Admin',
        password: 'UniqueAdminPass123!',
      },
      connection,
    );

    await expect(
      connection
        .collection('staffusers')
        .countDocuments({ status: 'active', roles: 'admin' }),
    ).resolves.toBe(1);
    expect(result).toEqual({
      created: false,
      reason: 'active-admin-exists',
    });
  });

  it('requires caller-supplied credentials and rejects demo passwords', () => {
    expect(() => readBootstrapAdminOptions({})).toThrow(
      'FIRST_ADMIN_EMAIL is required',
    );
    expect(() =>
      readBootstrapAdminOptions({
        FIRST_ADMIN_EMAIL: 'admin@example.test',
      }),
    ).toThrow('FIRST_ADMIN_PASSWORD is required');
    expect(() =>
      readBootstrapAdminOptions({
        FIRST_ADMIN_EMAIL: 'admin@example.test',
        FIRST_ADMIN_PASSWORD: 'AdminPass123!',
      }),
    ).toThrow('FIRST_ADMIN_PASSWORD must not use demo credentials');
  });
});
