import { ConfigService } from '@nestjs/config';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model } from 'mongoose';
import { AuthIdentifierReconciliationService } from '../src/auth/auth-identifier-reconciliation.service';
import { AuthIdentifierRepairKeyPolicyService } from '../src/auth/auth-identifier-repair-key-policy.service';
import {
  AuthIdentifierAssignmentAction,
  AuthIdentifierAssignmentStatus,
  AuthIdentifierOperationCleanupStatus,
  AuthIdentifierOperationDocument,
  AuthIdentifierOperationModelName,
  AuthIdentifierOperationSchema,
  AuthIdentifierOperationStatus,
  AuthIdentifierOperationType,
} from '../src/auth/schemas/auth-identifier-operation.schema';
import {
  AuthIdentifierRepairBatchDocument,
  AuthIdentifierRepairBatchModelName,
  AuthIdentifierRepairBatchSchema,
  AuthIdentifierRepairBatchStatus,
} from '../src/auth/schemas/auth-identifier-repair-batch.schema';
import {
  AuthIdentifierDocument,
  AuthIdentifierModelName,
  AuthIdentifierPendingAction,
  AuthIdentifierSchema,
  AuthIdentifierStatus,
  AuthIdentifierSubjectType,
  AuthIdentifierType,
} from '../src/auth/schemas/auth-identifier.schema';
import {
  AuthThrottleBucketDocument,
  AuthThrottleBucketModelName,
  AuthThrottleBucketSchema,
} from '../src/auth/schemas/auth-throttle-bucket.schema';
import {
  SecurityActivityEventDocument,
  SecurityActivityEventModelName,
  SecurityActivityEventSchema,
} from '../src/auth/schemas/security-activity-event.schema';
import { SecurityActivityService } from '../src/auth/security-activity.service';

describe('auth identifier reconciliation recovery (e2e)', () => {
  jest.setTimeout(120000);

  let mongoServer: MongoMemoryServer;
  let connection: Connection;
  let operations: Model<AuthIdentifierOperationDocument>;
  let identifiers: Model<AuthIdentifierDocument>;
  let batches: Model<AuthIdentifierRepairBatchDocument>;
  let throttles: Model<AuthThrottleBucketDocument>;
  let events: Model<SecurityActivityEventDocument>;
  let keyRing: Record<string, string>;
  let config: ConfigService;
  let policy: AuthIdentifierRepairKeyPolicyService;
  let securityActivity: SecurityActivityService;

  const auditKey = Buffer.alloc(32, 7).toString('base64url');

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    connection = await mongoose
      .createConnection(mongoServer.getUri(), { autoIndex: false })
      .asPromise();
    operations = connection.model(
      AuthIdentifierOperationModelName,
      AuthIdentifierOperationSchema,
    );
    identifiers = connection.model(
      AuthIdentifierModelName,
      AuthIdentifierSchema,
    );
    batches = connection.model(
      AuthIdentifierRepairBatchModelName,
      AuthIdentifierRepairBatchSchema,
    );
    throttles = connection.model(
      AuthThrottleBucketModelName,
      AuthThrottleBucketSchema,
    );
    events = connection.model(
      SecurityActivityEventModelName,
      SecurityActivityEventSchema,
    );

    await Promise.all([
      operations.createCollection(),
      identifiers.createCollection(),
      batches.createCollection(),
      throttles.createCollection(),
      events.createCollection(),
    ]);
    await Promise.all([
      operations.createIndexes(),
      identifiers.createIndexes(),
      batches.createIndexes(),
      throttles.createIndexes(),
      events.createIndexes(),
    ]);
  });

  afterAll(async () => {
    await connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      operations.deleteMany({}),
      identifiers.deleteMany({}),
      batches.deleteMany({}),
      throttles.deleteMany({}),
      events.deleteMany({}),
    ]);
    keyRing = { 1: auditKey };
    const values: Record<string, unknown> = {
      'auth.auditCorrelationKeyVersion': 1,
      'auth.auditCorrelationSecret': auditKey,
      'auth.auditCorrelationPreviousKeys': {},
      'auth.identifierLeaseSeconds': 30,
      'auth.identifierReconciliationIntervalSeconds': 60,
      'auth.identifierReconciliationBatchSize': 10,
      'auth.identifierOperationRetentionDays': 90,
      'auth.identifierMaxOperationAssignments': 2,
    };
    config = {
      get: (path: string) => {
        if (path === 'auth.auditCorrelationKeyRing') {
          return { currentVersion: 1, keysByVersion: keyRing };
        }
        if (path === 'auth.auditCorrelationKeyRing.currentVersion') {
          return 1;
        }
        return values[path];
      },
    } as ConfigService;
    policy = new AuthIdentifierRepairKeyPolicyService(
      operations as never,
      throttles as never,
      config,
    );
    securityActivity = new SecurityActivityService(events);
  });

  function createService(): AuthIdentifierReconciliationService {
    return new AuthIdentifierReconciliationService(
      operations,
      identifiers,
      batches,
      policy,
      securityActivity,
      config,
    );
  }

  function baseOperation(
    operationId: string,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      operationId,
      operationType: AuthIdentifierOperationType.Claim,
      status: AuthIdentifierOperationStatus.Pending,
      assignments: [],
      cleanupStatus: AuthIdentifierOperationCleanupStatus.NotRequired,
      requestedBy: {
        subjectType: AuthIdentifierSubjectType.Staff,
        subjectId: 'admin-1',
      },
      ...overrides,
    };
  }

  it('allows only one competing worker to claim an operation', async () => {
    await operations.create(baseOperation('competing-operation'));
    const first = createService();
    const second = createService();

    const results = await Promise.all([
      first.reconcileOnce(),
      second.reconcileOnce(),
    ]);

    expect(results.reduce((sum, result) => sum + result.claimed, 0)).toBe(1);
    await expect(
      operations.findOne({ operationId: 'competing-operation' }).lean(),
    ).resolves.toMatchObject({
      status: AuthIdentifierOperationStatus.Applying,
    });
  });

  it('does not mutate an offline repair with a missing key and resumes after restoration', async () => {
    await operations.create(
      baseOperation('missing-key-operation', {
        operationType: AuthIdentifierOperationType.OfflineRepair,
        manifestHash: 'manifest-hmac',
        manifestKeyVersion: 9,
      }),
    );
    const service = createService();

    await expect(service.reconcileOnce()).resolves.toMatchObject({
      claimed: 0,
      skippedMissingKey: 1,
    });
    const blocked = await operations
      .findOne({ operationId: 'missing-key-operation' })
      .lean();
    expect(blocked).toMatchObject({
      status: AuthIdentifierOperationStatus.Pending,
    });
    expect(blocked).not.toHaveProperty('leaseOwner');
    expect(blocked).not.toHaveProperty('leaseExpiresAt');

    keyRing[9] = Buffer.alloc(32, 9).toString('base64url');
    await expect(service.reconcileOnce()).resolves.toMatchObject({
      claimed: 1,
      processed: 1,
    });
    await expect(
      operations.findOne({ operationId: 'missing-key-operation' }).lean(),
    ).resolves.toMatchObject({
      status: AuthIdentifierOperationStatus.Applying,
    });
  });

  it('repairs a missing reservation reference with HMAC-only correlation and remains fail closed', async () => {
    await operations.create(
      baseOperation('reference-operation', {
        status: AuthIdentifierOperationStatus.Applying,
        assignments: [
          {
            assignmentId: 'assignment-1',
            subjectType: AuthIdentifierSubjectType.Member,
            subjectId: 'member-1',
            action: AuthIdentifierAssignmentAction.Claim,
            status: AuthIdentifierAssignmentStatus.Pending,
          },
        ],
      }),
    );
    const reservation = await identifiers.create({
      normalizedIdentifier: 'member.private@example.test',
      identifierType: AuthIdentifierType.Email,
      subjectType: AuthIdentifierSubjectType.Member,
      subjectId: 'member-1',
      status: AuthIdentifierStatus.Pending,
      pendingOperationId: 'reference-operation',
      pendingAction: AuthIdentifierPendingAction.Claim,
      createdBy: 'system',
      updatedBy: 'system',
    });

    await createService().reconcileOnce();

    const recovered = await operations
      .findOne({ operationId: 'reference-operation' })
      .lean();
    expect(recovered).toMatchObject({
      status: AuthIdentifierOperationStatus.FailedRetryable,
      assignments: [
        expect.objectContaining({
          targetReservationId: reservation._id,
          correlationKeyVersion: 1,
          identifierCorrelationHash: expect.any(String),
        }),
      ],
    });
    expect(JSON.stringify(recovered)).not.toContain(
      'member.private@example.test',
    );
    await expect(
      identifiers.findById(reservation._id).lean(),
    ).resolves.toMatchObject({
      status: AuthIdentifierStatus.Pending,
      pendingOperationId: 'reference-operation',
    });
  });

  it('compensates pending saga reservations idempotently', async () => {
    const reservation = await identifiers.create({
      normalizedIdentifier: 'compensate@example.test',
      identifierType: AuthIdentifierType.Email,
      subjectType: AuthIdentifierSubjectType.Staff,
      subjectId: 'staff-1',
      status: AuthIdentifierStatus.Pending,
      pendingOperationId: 'compensating-operation',
      pendingAction: AuthIdentifierPendingAction.Claim,
      createdBy: 'system',
      updatedBy: 'system',
    });
    await operations.create(
      baseOperation('compensating-operation', {
        status: AuthIdentifierOperationStatus.Compensating,
        assignments: [
          {
            assignmentId: 'assignment-1',
            subjectType: AuthIdentifierSubjectType.Staff,
            subjectId: 'staff-1',
            action: AuthIdentifierAssignmentAction.Claim,
            targetReservationId: reservation._id,
            status: AuthIdentifierAssignmentStatus.Pending,
          },
        ],
      }),
    );

    await createService().reconcileOnce();

    await expect(
      identifiers.findById(reservation._id).lean(),
    ).resolves.toMatchObject({
      status: AuthIdentifierStatus.Released,
      lastOperationId: 'compensating-operation',
    });
    const recovered = await operations
      .findOne({ operationId: 'compensating-operation' })
      .lean();
    expect(recovered).toMatchObject({
      status: AuthIdentifierOperationStatus.Finalizing,
      assignments: [
        expect.objectContaining({
          status: AuthIdentifierAssignmentStatus.Compensated,
        }),
      ],
    });
  });

  it('persists terminal audit before TTL and completes activation-gate cleanup in bounded passes', async () => {
    const service = createService();
    await operations.create(
      baseOperation('finalizing-operation', {
        operationType: AuthIdentifierOperationType.OfflineRepair,
        status: AuthIdentifierOperationStatus.Finalizing,
        manifestHash: 'manifest-hmac',
        manifestKeyVersion: 1,
        cleanupStatus: AuthIdentifierOperationCleanupStatus.Pending,
        assignments: [
          {
            assignmentId: 'assignment-1',
            subjectType: AuthIdentifierSubjectType.Member,
            subjectId: 'member-1',
            action: AuthIdentifierAssignmentAction.Claim,
            status: AuthIdentifierAssignmentStatus.Applied,
          },
        ],
      }),
    );

    await service.reconcileOnce();
    const terminal = await operations
      .findOne({ operationId: 'finalizing-operation' })
      .lean();
    expect(terminal).toMatchObject({
      status: AuthIdentifierOperationStatus.Completed,
      cleanupStatus: AuthIdentifierOperationCleanupStatus.Pending,
      terminalEventId: expect.any(String),
      terminalEventRecordedAt: expect.any(Date),
    });
    expect(terminal).not.toHaveProperty('expiresAt');
    await expect(
      events.countDocuments({ eventId: terminal?.terminalEventId }),
    ).resolves.toBe(1);

    await identifiers.create({
      normalizedIdentifier: 'gated@example.test',
      identifierType: AuthIdentifierType.Email,
      subjectType: AuthIdentifierSubjectType.Member,
      subjectId: 'member-1',
      status: AuthIdentifierStatus.Active,
      activationGateOperationId: 'finalizing-operation',
      createdBy: 'system',
      updatedBy: 'system',
    });
    await batches.create({
      parentOperationId: 'finalizing-operation',
      batchNumber: 0,
      batchCount: 1,
      status: AuthIdentifierRepairBatchStatus.Activated,
      assignments: [
        {
          assignmentId: 'assignment-1',
          subjectType: AuthIdentifierSubjectType.Member,
          subjectId: 'member-1',
          action: AuthIdentifierAssignmentAction.Claim,
          status: AuthIdentifierAssignmentStatus.Applied,
        },
      ],
      checkpointHash: 'checkpoint-hmac',
      manifestKeyVersion: 1,
    });

    await operations.updateOne(
      { operationId: 'finalizing-operation' },
      { $unset: { leaseOwner: '', leaseExpiresAt: '' } },
    );
    await service.reconcileOnce();

    await expect(
      identifiers.findOne({
        activationGateOperationId: 'finalizing-operation',
      }),
    ).resolves.toBeNull();
    const cleaned = await operations
      .findOne({ operationId: 'finalizing-operation' })
      .lean();
    expect(cleaned).toMatchObject({
      cleanupStatus: AuthIdentifierOperationCleanupStatus.Completed,
      expiresAt: expect.any(Date),
    });
    await expect(
      batches.findOne({ parentOperationId: 'finalizing-operation' }).lean(),
    ).resolves.toMatchObject({ expiresAt: expect.any(Date) });
  });
});
