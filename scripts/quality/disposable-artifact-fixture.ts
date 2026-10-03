import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import {
  loadMigrations,
  MigrationConnection,
  runPendingMigrations,
} from '../../migrations/migrate';

// Never accepts an external URI and never imports the application's seed entry points.
export async function createArtifactFixture(bindAll = false) {
  const mongo = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      ip: bindAll ? '0.0.0.0' : '127.0.0.1',
      spawn: { detached: true },
    },
  });
  const uri = mongo.getUri('disposable-upgrade-artifact');
  const connection = mongoose.createConnection(uri);
  try {
    await connection.asPromise();
    const password = 'Disposable-artifact-password-2026';
    const passwordHash = await bcrypt.hash(password, 10);
    const memberId = new Types.ObjectId('507f1f77bcf86cd799439023');
    const otherMemberId = new Types.ObjectId('507f1f77bcf86cd799439024');
    const bookId = new Types.ObjectId('507f1f77bcf86cd799439025');
    const categoryId = new Types.ObjectId('507f1f77bcf86cd799439026');
    await connection.collection('staffusers').insertMany(
      ['staff', 'admin'].map((role) => ({
        email: `${role}@artifact.example.test`,
        displayName: `Synthetic ${role}`,
        passwordHash,
        roles: [role],
        status: 'active',
        authVersion: 0,
      })),
    );
    await connection.collection('membershiptypes').insertOne({
      _id: categoryId,
      code: 'ARTIFACT',
      name: 'Synthetic Standard',
      maxActiveLoans: 3,
      status: 'active',
    });
    await connection.collection('members').insertMany([
      {
        _id: memberId,
        memberNumber: 'ARTIFACT-001',
        fullName: 'Synthetic Reader',
        loginIdentifier: 'member@artifact.example.test',
        passwordHash,
        membershipTypeId: categoryId,
        status: 'active',
        authStatus: 'active',
        authVersion: 0,
        activeLoanCount: 0,
      },
      {
        _id: otherMemberId,
        memberNumber: 'ARTIFACT-002',
        fullName: 'Other Synthetic Reader',
        membershipTypeId: categoryId,
        status: 'active',
        authStatus: 'active',
        authVersion: 0,
        activeLoanCount: 0,
      },
    ]);
    await runPendingMigrations(
      connection as unknown as MigrationConnection,
      await loadMigrations(),
    );
    await connection.collection('books').insertOne({
      _id: bookId,
      title: 'Artifact Fixture Book',
      catalogIdentifier: 'ARTIFACT-BOOK-001',
      categoryId,
      totalQuantity: 3,
      availableQuantity: 3,
      status: 'active',
    });
    await connection.collection('bookcategories').insertOne({
      _id: categoryId,
      name: 'Synthetic Category',
      code: 'ARTIFACT',
      loanPeriodDays: 14,
      status: 'active',
    });
    const environment: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      JWT_ISSUER: 'disposable-artifact-check',
      JWT_AUDIENCE: 'book-library-api',
      JWT_SECRET: randomBytes(48).toString('base64url'),
      AUTH_COOKIE_SECRET: randomBytes(48).toString('base64url'),
      AUTH_AUDIT_CORRELATION_SECRET: randomBytes(32).toString('base64url'),
      AUTH_AUDIT_CORRELATION_KEY_VERSION: '1',
      AUTH_AUDIT_CORRELATION_PREVIOUS_KEYS: '{}',
      AUTH_TRUSTED_BROWSER_ORIGINS: '["https://artifact.example.test"]',
      AUTH_TRUSTED_PROXY_CIDRS: '[]',
    };
    return {
      mongo,
      connection,
      uri,
      environment,
      password,
      memberId,
      otherMemberId,
      bookId,
      async stop() {
        await connection.close();
        await mongo.stop();
      },
    };
  } catch (error) {
    await Promise.allSettled([connection.close(), mongo.stop()]);
    throw error;
  }
}
