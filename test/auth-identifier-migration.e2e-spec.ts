import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model, Types } from 'mongoose';
import { MigrationConnection, MigrationSession } from '../migrations/migrate';
import {
  AUTH_MIGRATION_REQUIRED_INDEXES,
  findMissingAuthMigrationIndexes,
  migration,
} from '../migrations/versions/003-auth-roles-permissions';
import {
  AuthSubjectType,
  RefreshTokenFamilyDocument,
  RefreshTokenFamilySchema,
  RefreshTokenFamilyStatus,
} from '../src/auth/schemas/refresh-token-family.schema';

type IndexDescription = {
  name?: string;
  key: Record<string, number>;
  unique?: boolean;
  sparse?: boolean;
  expireAfterSeconds?: number;
  partialFilterExpression?: Record<string, unknown>;
};

function containsPlanStage(value: unknown, stage: string): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => containsPlanStage(entry, stage));
  }
  if (!value || typeof value !== 'object') {
    return false;
  }

  const document = value as Record<string, unknown>;
  return (
    document.stage === stage ||
    Object.values(document).some((entry) => containsPlanStage(entry, stage))
  );
}

async function indexesByName(
  connection: Connection,
  collectionName: string,
): Promise<Map<string, IndexDescription>> {
  const indexes = (await connection
    .collection(collectionName)
    .listIndexes()
    .toArray()) as IndexDescription[];

  return new Map(
    indexes
      .filter((index): index is IndexDescription & { name: string } =>
        Boolean(index.name),
      )
      .map((index) => [index.name, index]),
  );
}

describe('003 auth roles and permissions migration (e2e)', () => {
  jest.setTimeout(120_000);

  let mongoServer: MongoMemoryServer;
  let connection: Connection;
  let refreshFamilyModel: Model<RefreshTokenFamilyDocument>;
  let originalMaxAssignments: string | undefined;
  const activeFamilyId = 'legacy-active-family';
  const revokedFamilyId = 'legacy-revoked-family';
  const familyExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000);
  const originalCreatedAt = new Date('2025-01-01T00:00:00.000Z');
  const originalUpdatedAt = new Date('2025-01-02T00:00:00.000Z');
  const originalRevokedAt = new Date('2025-01-03T00:00:00.000Z');

  beforeAll(async () => {
    originalMaxAssignments =
      process.env.AUTH_IDENTIFIER_MAX_OPERATION_ASSIGNMENTS;
    process.env.AUTH_IDENTIFIER_MAX_OPERATION_ASSIGNMENTS = '2';
    mongoServer = await MongoMemoryServer.create();
    connection = await mongoose
      .createConnection(mongoServer.getUri())
      .asPromise();

    const staffUsers = connection.collection('staffusers');
    const members = connection.collection('members');
    const refreshFamilies = connection.collection('refresh_token_families');
    const securityEvents = connection.collection('security_activity_events');

    await staffUsers.insertMany([
      {
        _id: new Types.ObjectId(),
        email: ' Unique.Staff@Example.Test ',
        passwordHash: 'not-a-real-hash',
      },
      {
        _id: new Types.ObjectId(),
        email: 'review-conflict@example.test',
      },
      {
        _id: new Types.ObjectId(),
        email: 'oversized-conflict@example.test',
      },
    ]);
    await members.insertMany([
      {
        _id: new Types.ObjectId(),
        loginIdentifier: 'unique.member@example.test',
        memberNumber: 'M-1001',
      },
      {
        _id: new Types.ObjectId(),
        loginIdentifier: 'REVIEW-CONFLICT@example.test',
        memberNumber: 'M-1002',
      },
      {
        _id: new Types.ObjectId(),
        loginIdentifier: 'oversized-conflict@example.test',
        memberNumber: 'M-1003',
      },
      {
        _id: new Types.ObjectId(),
        loginIdentifier: 'OVERSIZED-CONFLICT@example.test',
        memberNumber: 'M-1004',
      },
    ]);
    await refreshFamilies.insertMany([
      {
        familyId: activeFamilyId,
        status: 'active',
        currentTokenHash: 'legacy-current-active',
        previousTokenHash: 'legacy-previous-active',
        expiresAt: familyExpiry,
        createdAt: originalCreatedAt,
        updatedAt: originalUpdatedAt,
        auditTrail: [{ category: 'family-created' }],
      },
      {
        familyId: revokedFamilyId,
        status: 'revoked',
        revokedAt: originalRevokedAt,
        revokedReason: 'administrator-action',
        currentTokenHash: 'legacy-current-revoked',
        previousTokenHash: 'legacy-previous-revoked',
        expiresAt: familyExpiry,
        createdAt: originalCreatedAt,
        updatedAt: originalUpdatedAt,
        auditTrail: [{ category: 'administrator-revocation' }],
      },
    ]);
    await securityEvents.insertOne({
      eventType: 'sign-in-success',
      actorType: 'staff',
      actorId: 'historical-actor',
      outcome: 'success',
      createdAt: originalCreatedAt,
    });

    await migration.up({
      connection: connection as unknown as MigrationConnection,
      session: {} as MigrationSession,
    });

    refreshFamilyModel = connection.model<RefreshTokenFamilyDocument>(
      'MigrationTestRefreshTokenFamily',
      RefreshTokenFamilySchema,
      'refresh_token_families',
    );
  });

  afterAll(async () => {
    if (originalMaxAssignments === undefined) {
      delete process.env.AUTH_IDENTIFIER_MAX_OPERATION_ASSIGNMENTS;
    } else {
      process.env.AUTH_IDENTIFIER_MAX_OPERATION_ASSIGNMENTS =
        originalMaxAssignments;
    }
    await connection.close();
    await mongoServer.stop();
  });

  it('creates identifier, operation, batch, event, throttle, family, and replay indexes', async () => {
    const identifiers = await indexesByName(connection, 'auth_identifiers');
    const operations = await indexesByName(
      connection,
      'auth_identifier_operations',
    );
    const batches = await indexesByName(
      connection,
      'auth_identifier_repair_batches',
    );
    const events = await indexesByName(connection, 'security_activity_events');
    const families = await indexesByName(connection, 'refresh_token_families');
    const replayMarkers = await indexesByName(
      connection,
      'refresh_token_replay_markers',
    );
    const throttleBuckets = await indexesByName(
      connection,
      'auth_throttle_buckets',
    );

    expect(identifiers.get('uq_auth_identifier_normalized')).toMatchObject({
      key: { normalizedIdentifier: 1 },
      unique: true,
    });
    expect(
      identifiers.get('ix_auth_identifier_pending_operation'),
    ).toMatchObject({
      key: { pendingOperationId: 1, status: 1 },
      sparse: true,
    });
    expect(identifiers.get('ix_auth_identifier_activation_gate')).toMatchObject(
      {
        key: { activationGateOperationId: 1, status: 1 },
        sparse: true,
      },
    );
    expect(operations.get('uq_auth_identifier_operation_id')).toMatchObject({
      key: { operationId: 1 },
      unique: true,
    });
    expect(
      operations.get('uq_auth_identifier_operation_terminal_event'),
    ).toMatchObject({
      key: { terminalEventId: 1 },
      unique: true,
      sparse: true,
    });
    expect(
      operations.get('ix_auth_identifier_operation_repair_key_policy'),
    ).toMatchObject({
      key: {
        operationType: 1,
        status: 1,
        cleanupStatus: 1,
        manifestKeyVersion: 1,
      },
      partialFilterExpression: {
        operationType: 'offline-repair',
        manifestKeyVersion: { $exists: true },
      },
    });
    expect(operations.get('ttl_auth_identifier_operation')).toMatchObject({
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    });
    expect(
      batches.get('uq_auth_identifier_repair_batch_checkpoint'),
    ).toMatchObject({
      key: { parentOperationId: 1, batchNumber: 1 },
      unique: true,
    });
    expect(batches.get('ttl_auth_identifier_repair_batch')).toMatchObject({
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    });
    expect(events.get('uq_security_activity_event_id')).toMatchObject({
      key: { eventId: 1 },
      unique: true,
      sparse: true,
    });
    expect(families.get('uq_refresh_token_family_current_hash')).toMatchObject({
      key: { currentTokenHash: 1 },
      unique: true,
      sparse: true,
    });
    expect(families.get('ix_refresh_token_family_last_rotation')).toMatchObject(
      {
        key: { lastRotationOperationId: 1 },
        sparse: true,
      },
    );
    expect(
      replayMarkers.get('uq_refresh_replay_marker_token_hash'),
    ).toMatchObject({ key: { tokenHash: 1 }, unique: true });
    expect(
      replayMarkers.get('uq_refresh_replay_marker_rotation_operation'),
    ).toMatchObject({ key: { rotationOperationId: 1 }, unique: true });
    expect(
      replayMarkers.get('ix_refresh_replay_marker_status_lease'),
    ).toMatchObject({ key: { status: 1, leaseExpiresAt: 1 } });
    expect(replayMarkers.get('ttl_refresh_replay_marker')).toMatchObject({
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    });
    expect(
      throttleBuckets.get('uq_auth_throttle_bucket_dimension_key'),
    ).toMatchObject({
      key: { dimension: 1, keyVersion: 1, bucketKey: 1 },
      unique: true,
    });
    expect(
      throttleBuckets.get('ix_auth_throttle_bucket_key_version_expiry'),
    ).toMatchObject({ key: { keyVersion: 1, expiresAt: 1 } });
    expect(throttleBuckets.get('ttl_auth_throttle_bucket')).toMatchObject({
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    });
  });

  it('does not synthesize ephemeral throttle history during migration', async () => {
    await expect(
      connection.collection('auth_throttle_buckets').countDocuments({}),
    ).resolves.toBe(0);
  });

  it('uses indexes for repair, throttle-key, and replay reconciliation lookups', async () => {
    const now = new Date();
    await connection.collection('auth_identifier_operations').insertOne({
      operationId: 'repair-key-query',
      operationType: 'offline-repair',
      status: 'applying',
      cleanupStatus: 'pending',
      manifestKeyVersion: 7,
      createdAt: now,
      updatedAt: now,
    });
    await connection.collection('auth_throttle_buckets').insertOne({
      dimension: 'sign-in-source',
      keyVersion: 7,
      bucketKey: 'throttle-query-key',
      count: 1,
      windowStartedAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
    });
    await connection.collection('refresh_token_replay_markers').insertOne({
      tokenHash: 'pending-query-hash',
      familyId: 'pending-query-family',
      status: 'pending',
      rotationOperationId: 'pending-query-operation',
      leaseExpiresAt: new Date(now.getTime() - 1_000),
      expiresAt: familyExpiry,
    });

    const repairPlan = await connection
      .collection('auth_identifier_operations')
      .find({
        operationType: 'offline-repair',
        status: 'applying',
        cleanupStatus: 'pending',
        manifestKeyVersion: 7,
      })
      .hint('ix_auth_identifier_operation_repair_key_policy')
      .explain('executionStats');
    const throttlePlan = await connection
      .collection('auth_throttle_buckets')
      .find({ keyVersion: 7, expiresAt: { $gt: now } })
      .hint('ix_auth_throttle_bucket_key_version_expiry')
      .explain('executionStats');
    const replayPlan = await connection
      .collection('refresh_token_replay_markers')
      .find({ status: 'pending', leaseExpiresAt: { $lte: now } })
      .hint('ix_refresh_replay_marker_status_lease')
      .explain('executionStats');

    for (const plan of [repairPlan, throttlePlan, replayPlan]) {
      expect(containsPlanStage(plan, 'IXSCAN')).toBe(true);
      expect(containsPlanStage(plan, 'COLLSCAN')).toBe(false);
    }
  });

  it('enforces parent-batch, throttle, replay-hash, and replay-operation uniqueness', async () => {
    const batches = connection.collection('auth_identifier_repair_batches');
    const throttleBuckets = connection.collection('auth_throttle_buckets');
    const replayMarkers = connection.collection('refresh_token_replay_markers');

    await batches.insertOne({ parentOperationId: 'parent-1', batchNumber: 0 });
    await expect(
      batches.insertOne({ parentOperationId: 'parent-1', batchNumber: 0 }),
    ).rejects.toMatchObject({ code: 11000 });

    await throttleBuckets.insertOne({
      dimension: 'refresh-source',
      keyVersion: 3,
      bucketKey: 'same-throttle-key',
      expiresAt: familyExpiry,
    });
    await expect(
      throttleBuckets.insertOne({
        dimension: 'refresh-source',
        keyVersion: 3,
        bucketKey: 'same-throttle-key',
        expiresAt: familyExpiry,
      }),
    ).rejects.toMatchObject({ code: 11000 });

    await replayMarkers.insertOne({
      tokenHash: 'unique-replay-hash',
      rotationOperationId: 'unique-rotation-operation',
      familyId: 'unique-family',
      status: 'pending',
      leaseExpiresAt: familyExpiry,
      expiresAt: familyExpiry,
    });
    await expect(
      replayMarkers.insertOne({
        tokenHash: 'unique-replay-hash',
        rotationOperationId: 'second-rotation-operation',
        familyId: 'second-family',
        status: 'pending',
        leaseExpiresAt: familyExpiry,
        expiresAt: familyExpiry,
      }),
    ).rejects.toMatchObject({ code: 11000 });
    await expect(
      replayMarkers.insertOne({
        tokenHash: 'second-replay-hash',
        rotationOperationId: 'unique-rotation-operation',
        familyId: 'second-family',
        status: 'pending',
        leaseExpiresAt: familyExpiry,
        expiresAt: familyExpiry,
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('revokes all active legacy families, removes incomplete hashes, and preserves expiry and audit history', async () => {
    const activeFamily = await connection
      .collection('refresh_token_families')
      .findOne({ familyId: activeFamilyId });
    const alreadyRevokedFamily = await connection
      .collection('refresh_token_families')
      .findOne({ familyId: revokedFamilyId });

    expect(activeFamily).toMatchObject({
      status: 'revoked',
      revokedReason: 'security-upgrade-reauth',
      revokedAt: expect.any(Date),
      expiresAt: familyExpiry,
      createdAt: originalCreatedAt,
      updatedAt: originalUpdatedAt,
      auditTrail: [{ category: 'family-created' }],
    });
    expect(activeFamily).not.toHaveProperty('currentTokenHash');
    expect(activeFamily).not.toHaveProperty('previousTokenHash');
    expect(alreadyRevokedFamily).toMatchObject({
      status: 'revoked',
      revokedReason: 'administrator-action',
      revokedAt: originalRevokedAt,
      expiresAt: familyExpiry,
      auditTrail: [{ category: 'administrator-revocation' }],
    });
    expect(alreadyRevokedFamily).not.toHaveProperty('currentTokenHash');
    expect(alreadyRevokedFamily).not.toHaveProperty('previousTokenHash');
    await expect(
      connection.collection('refresh_token_replay_markers').countDocuments({
        familyId: { $in: [activeFamilyId, revokedFamilyId] },
      }),
    ).resolves.toBe(0);

    const activeWithoutHash = new refreshFamilyModel({
      familyId: 'invalid-active-family',
      clientId: 'web',
      subjectType: AuthSubjectType.Staff,
      subjectId: 'staff-1',
      scopes: [],
      authVersion: 0,
      status: RefreshTokenFamilyStatus.Active,
      issuedAt: new Date(),
      lastRotatedAt: new Date(),
      expiresAt: familyExpiry,
    });
    const revokedWithoutHash = new refreshFamilyModel({
      familyId: 'valid-revoked-family',
      clientId: 'web',
      subjectType: AuthSubjectType.Staff,
      subjectId: 'staff-1',
      scopes: [],
      authVersion: 0,
      status: RefreshTokenFamilyStatus.Revoked,
      issuedAt: new Date(),
      lastRotatedAt: new Date(),
      expiresAt: familyExpiry,
    });

    await expect(activeWithoutHash.validate()).rejects.toThrow(
      /currentTokenHash/,
    );
    await expect(revokedWithoutHash.validate()).resolves.toBeUndefined();
  });

  it('backfills clean reservations and blocks reviewable and oversized legacy ambiguity', async () => {
    const identifiers = connection.collection('auth_identifiers');
    const uniqueStaff = await identifiers.findOne({
      normalizedIdentifier: 'unique.staff@example.test',
    });
    const uniqueMemberLogin = await identifiers.findOne({
      normalizedIdentifier: 'unique.member@example.test',
    });
    const uniqueMemberNumber = await identifiers.findOne({
      normalizedIdentifier: 'm-1001',
    });
    const reviewableConflict = await identifiers.findOne({
      normalizedIdentifier: 'review-conflict@example.test',
    });
    const oversizedConflict = await identifiers.findOne({
      normalizedIdentifier: 'oversized-conflict@example.test',
    });

    expect(uniqueStaff).toMatchObject({
      identifierType: 'email',
      subjectType: 'staff',
      status: 'active',
      createdBy: 'migration:003-auth-roles-permissions',
    });
    expect(uniqueMemberLogin).toMatchObject({
      identifierType: 'login-identifier',
      subjectType: 'member',
      status: 'active',
    });
    expect(uniqueMemberNumber).toMatchObject({
      identifierType: 'member-number',
      subjectType: 'member',
      status: 'active',
    });
    expect(reviewableConflict).toMatchObject({
      status: 'conflict',
      conflictResolutionStatus: 'reviewable',
    });
    expect(reviewableConflict).not.toHaveProperty('subjectId');
    expect(reviewableConflict?.conflictingSubjects).toHaveLength(2);
    expect(oversizedConflict).toMatchObject({
      status: 'conflict',
      conflictResolutionStatus: 'manual-repair-required',
    });
    expect(oversizedConflict).not.toHaveProperty('subjectId');
    expect(oversizedConflict?.conflictingSubjects).toHaveLength(3);

    const reports = await connection
      .collection('security_activity_events')
      .find({ eventType: 'identifier-conflict-detected' })
      .toArray();
    expect(reports).toHaveLength(2);
    expect(reports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorType: 'system',
          outcome: 'denied',
          reasonCategory: 'legacy-identifier-conflict',
        }),
        expect.objectContaining({
          actorType: 'system',
          outcome: 'denied',
          reasonCategory: 'legacy-identifier-conflict-oversized',
        }),
      ]),
    );
    for (const report of reports) {
      expect(JSON.stringify(report)).not.toMatch(
        /review-conflict|oversized-conflict|token|password/i,
      );
    }
    await expect(
      connection
        .collection('security_activity_events')
        .countDocuments({ actorId: 'historical-actor' }),
    ).resolves.toBe(1);
  });

  it('reports missing migration indexes deterministically', async () => {
    await expect(
      findMissingAuthMigrationIndexes(
        connection as unknown as MigrationConnection,
      ),
    ).resolves.toEqual([]);

    const collectionName = 'auth_throttle_buckets';
    const indexName = 'ix_auth_throttle_bucket_key_version_expiry';
    await connection.collection(collectionName).dropIndex(indexName);
    await expect(
      findMissingAuthMigrationIndexes(
        connection as unknown as MigrationConnection,
      ),
    ).resolves.toContain(`${collectionName}.${indexName}`);
    await connection
      .collection(collectionName)
      .createIndex({ keyVersion: 1, expiresAt: 1 }, { name: indexName });

    expect(AUTH_MIGRATION_REQUIRED_INDEXES[collectionName]).toContain(
      indexName,
    );
  });

  it('is idempotent without reactivating legacy sessions and documents safe rollback boundaries', async () => {
    await migration.up({
      connection: connection as unknown as MigrationConnection,
      session: {} as MigrationSession,
    });

    const activeFamily = await connection
      .collection('refresh_token_families')
      .findOne({ familyId: activeFamilyId });
    expect(activeFamily).toMatchObject({
      status: 'revoked',
      revokedReason: 'security-upgrade-reauth',
    });
    expect(activeFamily).not.toHaveProperty('currentTokenHash');
    expect(activeFamily).not.toHaveProperty('previousTokenHash');
    await expect(
      connection.collection('auth_identifiers').countDocuments({
        normalizedIdentifier: 'oversized-conflict@example.test',
      }),
    ).resolves.toBe(1);
    await expect(
      connection.collection('security_activity_events').countDocuments({
        eventType: 'identifier-conflict-detected',
      }),
    ).resolves.toBe(2);

    expect(migration.rollbackNotes.join(' ')).toMatch(
      /must never restore currentTokenHash, previousTokenHash, or reactivate/i,
    );
    expect(migration.rollbackNotes.join(' ')).toMatch(
      /Remove only auth_identifiers whose createdBy is migration:003-auth-roles-permissions.*verifying the referenced account/i,
    );
    expect(
      (migration as unknown as MigrationDefinitionWithOptionalDown).down,
    ).toBeUndefined();
  });
});

interface MigrationDefinitionWithOptionalDown {
  down?: unknown;
}
