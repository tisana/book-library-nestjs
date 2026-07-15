import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { AuthIdentifierReconciliationService } from './auth-identifier-reconciliation.service';
import { AuthIdentifierRepairKeyPolicyService } from './auth-identifier-repair-key-policy.service';
import {
  AuthIdentifierAssignmentAction,
  AuthIdentifierAssignmentStatus,
  AuthIdentifierOperationCleanupStatus,
  AuthIdentifierOperationStatus,
  AuthIdentifierOperationType,
} from './schemas/auth-identifier-operation.schema';
import {
  AuthIdentifierPendingAction,
  AuthIdentifierStatus,
  AuthIdentifierSubjectType,
} from './schemas/auth-identifier.schema';

function query<T>(value: T, capture?: { limit?: number }) {
  const result = {
    sort: () => result,
    select: () => result,
    limit: (amount: number) => {
      if (capture) capture.limit = amount;
      return result;
    },
    lean: () => result,
    exec: async () => value,
  };
  return result;
}

function operation(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    operationId: 'operation-1',
    operationType: AuthIdentifierOperationType.Claim,
    status: AuthIdentifierOperationStatus.Pending,
    assignments: [],
    cleanupStatus: AuthIdentifierOperationCleanupStatus.NotRequired,
    requestedBy: {
      subjectType: AuthIdentifierSubjectType.Staff,
      subjectId: 'admin-1',
    },
    ...overrides,
  } as any;
}

describe('AuthIdentifierReconciliationService', () => {
  let operations: any;
  let identifiers: any;
  let batches: any;
  let policy: Pick<
    AuthIdentifierRepairKeyPolicyService,
    'repairWorkerDecision' | 'getKeyMaterial'
  >;
  let events: any;
  let config: ConfigService;
  let service: AuthIdentifierReconciliationService;

  beforeEach(() => {
    operations = {
      find: jest.fn().mockReturnValue(query([])),
      findOneAndUpdate: jest.fn().mockResolvedValue(null),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    identifiers = {
      find: jest.fn().mockReturnValue(query([])),
      findOne: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(null),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
      exists: jest.fn().mockResolvedValue(null),
    };
    batches = {
      find: jest.fn().mockReturnValue(query([])),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
      exists: jest.fn().mockResolvedValue(null),
    };
    policy = {
      repairWorkerDecision: jest.fn().mockReturnValue({
        allowed: true,
        reason: 'ready',
        requiredVersion: 1,
      }),
      getKeyMaterial: jest.fn().mockReturnValue('audit-key-material'),
    };
    events = {
      recordIdentifierOperationTerminal: jest
        .fn()
        .mockResolvedValue('auth-identifier-operation:operation-1:completed'),
    };
    const values: Record<string, number> = {
      'auth.auditCorrelationKeyRing.currentVersion': 1,
      'auth.identifierLeaseSeconds': 300,
      'auth.identifierReconciliationBatchSize': 2,
      'auth.identifierMaxOperationAssignments': 2,
      'auth.identifierOperationRetentionDays': 90,
    };
    config = { get: (key: string) => values[key] } as ConfigService;
    service = new AuthIdentifierReconciliationService(
      operations,
      identifiers,
      batches,
      policy as AuthIdentifierRepairKeyPolicyService,
      events,
      config,
    );
  });

  it('checks a repair key before acquiring a lease and leaves data unchanged when missing', async () => {
    operations.find.mockReturnValue(
      query([
        operation({
          operationType: AuthIdentifierOperationType.OfflineRepair,
          manifestKeyVersion: 9,
        }),
      ]),
    );
    (policy.repairWorkerDecision as jest.Mock).mockReturnValue({
      allowed: false,
      reason: 'repair-key-required',
      requiredVersion: 9,
    });

    await expect(service.reconcileOnce()).resolves.toMatchObject({
      claimed: 0,
      processed: 0,
      skippedMissingKey: 1,
    });
    expect(operations.findOneAndUpdate).not.toHaveBeenCalled();
    expect(operations.updateOne).not.toHaveBeenCalled();
    expect(identifiers.updateOne).not.toHaveBeenCalled();
  });

  it('uses MongoDB time for atomic lease acquisition and renewal', async () => {
    const candidate = operation();
    operations.find.mockReturnValue(query([candidate]));
    operations.findOneAndUpdate
      .mockResolvedValueOnce(candidate)
      .mockResolvedValueOnce(candidate);

    await service.reconcileOnce();
    await expect(service.renewLease(candidate.operationId)).resolves.toBe(true);

    const claimCall = operations.findOneAndUpdate.mock.calls[0];
    expect(JSON.stringify(claimCall[0])).toContain('$dateSubtract');
    expect(JSON.stringify(claimCall[1])).toContain('$$NOW');
    const renewalCall = operations.findOneAndUpdate.mock.calls[1];
    expect(JSON.stringify(renewalCall[0])).toContain('$$NOW');
    expect(JSON.stringify(renewalCall[1])).toContain('$dateAdd');
  });

  it('discovers pending reservations and attaches an HMAC-only reference', async () => {
    const assignment = {
      assignmentId: 'assignment-1',
      subjectType: AuthIdentifierSubjectType.Member,
      subjectId: 'member-1',
      action: AuthIdentifierAssignmentAction.Claim,
      status: AuthIdentifierAssignmentStatus.Pending,
    };
    const reservation = {
      _id: new Types.ObjectId(),
      normalizedIdentifier: 'private.member@example.test',
      subjectType: AuthIdentifierSubjectType.Member,
      subjectId: 'member-1',
      pendingAction: AuthIdentifierPendingAction.Claim,
      pendingOperationId: 'operation-1',
    };
    identifiers.find.mockReturnValue(query([reservation]));

    await (service as any).attachMissingReservationReferences(
      operation({ assignments: [assignment] }),
    );

    const update = operations.updateOne.mock.calls[0][1].$set;
    expect(update['assignments.$.targetReservationId']).toEqual(
      reservation._id,
    );
    expect(update['assignments.$.correlationKeyVersion']).toBe(1);
    expect(update['assignments.$.identifierCorrelationHash']).toEqual(
      expect.any(String),
    );
    expect(JSON.stringify(update)).not.toContain(
      reservation.normalizedIdentifier,
    );
  });

  it('moves a recoverable failed operation through a valid retry transition', async () => {
    jest
      .spyOn(service as any, 'attachMissingReservationReferences')
      .mockResolvedValue(undefined);

    await (service as any).process(
      operation({ status: AuthIdentifierOperationStatus.FailedRetryable }),
    );

    expect(operations.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'operation-1',
        status: AuthIdentifierOperationStatus.FailedRetryable,
      }),
      { $set: { status: AuthIdentifierOperationStatus.Applying } },
    );
  });

  it('persists the idempotent terminal event before writing terminal TTL state', async () => {
    const calls: string[] = [];
    events.recordIdentifierOperationTerminal.mockImplementation(async () => {
      calls.push('event');
      return 'auth-identifier-operation:operation-1:completed';
    });
    operations.findOneAndUpdate.mockImplementation(async () => {
      calls.push('operation');
      return operation({ status: AuthIdentifierOperationStatus.Completed });
    });

    await (service as any).finalize(
      operation({
        status: AuthIdentifierOperationStatus.Finalizing,
        assignments: [
          {
            assignmentId: 'a-1',
            status: AuthIdentifierAssignmentStatus.Applied,
          },
        ],
      }),
    );

    expect(calls).toEqual(['event', 'operation']);
    const pipeline = operations.findOneAndUpdate.mock.calls[0][1];
    expect(JSON.stringify(pipeline)).toContain('terminalEventRecordedAt');
    expect(JSON.stringify(pipeline)).toContain('expiresAt');
    expect(JSON.stringify(pipeline)).toContain('$$NOW');
  });

  it('replays finalization without creating a second logical terminal event', async () => {
    const finalizing = operation({
      status: AuthIdentifierOperationStatus.Finalizing,
      assignments: [{ status: AuthIdentifierAssignmentStatus.Applied }],
    });

    await (service as any).finalize(finalizing);
    await (service as any).finalize(finalizing);

    expect(events.recordIdentifierOperationTerminal).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ operationId: 'operation-1' }),
    );
    expect(events.recordIdentifierOperationTerminal).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ operationId: 'operation-1' }),
    );
    expect(
      await events.recordIdentifierOperationTerminal.mock.results[0].value,
    ).toBe(
      await events.recordIdentifierOperationTerminal.mock.results[1].value,
    );
  });

  it('bounds gate and batch cleanup and expires the parent only after both are clear', async () => {
    const gateCapture: { limit?: number } = {};
    const gate = { _id: new Types.ObjectId() };
    identifiers.find.mockReturnValue(query([gate], gateCapture));
    const batchCapture: { limit?: number } = {};
    batches.find.mockReturnValue(
      query([{ _id: new Types.ObjectId() }], batchCapture),
    );
    operations.findOneAndUpdate.mockResolvedValue(operation());

    await (service as any).cleanup(
      operation({
        status: AuthIdentifierOperationStatus.Completed,
        cleanupStatus: AuthIdentifierOperationCleanupStatus.Pending,
        terminalEventId: 'event-1',
        terminalEventRecordedAt: new Date(),
      }),
    );

    expect(gateCapture.limit).toBe(2);
    expect(batchCapture.limit).toBe(1);
    expect(identifiers.updateMany).toHaveBeenCalledWith(
      { _id: { $in: [gate._id] } },
      { $unset: { activationGateOperationId: '' } },
    );
    const parentCall =
      operations.findOneAndUpdate.mock.calls[
        operations.findOneAndUpdate.mock.calls.length - 1
      ];
    expect(parentCall[0]).toMatchObject({
      terminalEventId: { $exists: true },
      terminalEventRecordedAt: { $exists: true },
    });
    expect(JSON.stringify(parentCall[1])).toContain('expiresAt');
  });

  it('releases residual gates for a failed terminal repair instead of unlocking them', async () => {
    identifiers.find.mockReturnValue(query([{ _id: new Types.ObjectId() }]));
    operations.findOneAndUpdate.mockResolvedValue(operation());

    await (service as any).cleanup(
      operation({
        status: AuthIdentifierOperationStatus.FailedTerminal,
        cleanupStatus: AuthIdentifierOperationCleanupStatus.Pending,
        terminalEventId: 'event-1',
        terminalEventRecordedAt: new Date(),
      }),
    );

    expect(identifiers.updateMany.mock.calls[0][1]).toEqual({
      $set: { status: AuthIdentifierStatus.Released },
      $unset: { activationGateOperationId: '' },
    });
  });

  it('ignores clean terminal operations', async () => {
    operations.find.mockReturnValue(query([]));

    await expect(service.reconcileOnce()).resolves.toEqual({
      examined: 0,
      claimed: 0,
      processed: 0,
      skippedMissingKey: 0,
    });
    expect(operations.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
