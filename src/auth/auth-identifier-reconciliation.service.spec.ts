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

  it('starts one bounded schedule at bootstrap and clears it once on shutdown', async () => {
    const registry = {
      addInterval: jest.fn(),
      doesExist: jest.fn().mockReturnValue(true),
      deleteInterval: jest.fn(),
    };
    const scheduled = new AuthIdentifierReconciliationService(
      operations,
      identifiers,
      batches,
      policy as AuthIdentifierRepairKeyPolicyService,
      events,
      config,
      registry as any,
      {
        db: {
          collection: jest.fn().mockReturnValue({
            findOne: jest.fn().mockResolvedValue({ version: '003' }),
          }),
        },
      } as any,
    );

    await scheduled.onApplicationBootstrap();
    await scheduled.onApplicationBootstrap();
    scheduled.onApplicationShutdown();
    scheduled.onApplicationShutdown();

    expect(registry.addInterval).toHaveBeenCalledTimes(1);
    expect(registry.addInterval.mock.calls[0][0]).toBe(
      'auth-identifier-reconciliation',
    );
    expect(registry.deleteInterval).toHaveBeenCalledTimes(1);
  });

  it('skips reconciliation scheduling until the required auth migration is recorded', async () => {
    const registry = {
      addInterval: jest.fn(),
      doesExist: jest.fn().mockReturnValue(true),
      deleteInterval: jest.fn(),
    };
    const migrationRecord = jest.fn().mockResolvedValue(null);
    const migrationConnection = {
      db: {
        collection: jest.fn().mockReturnValue({
          findOne: migrationRecord,
        }),
      },
    };
    const gated = new (AuthIdentifierReconciliationService as any)(
      operations,
      identifiers,
      batches,
      policy,
      events,
      config,
      registry,
      migrationConnection,
    );
    const reconcile = jest.spyOn(gated, 'reconcileOnce');

    await gated.onApplicationBootstrap();

    expect(reconcile).not.toHaveBeenCalled();
    expect(registry.addInterval).not.toHaveBeenCalled();

    migrationRecord.mockResolvedValueOnce({ version: '003' });
    await gated.runReadinessProbe();

    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(registry.addInterval).toHaveBeenCalledTimes(1);
    gated.onApplicationShutdown();
  });

  it('shares one in-flight reconciliation pass between concurrent callers', async () => {
    let resolvePass!: (value: any) => void;
    const pass = new Promise<any>((resolve) => {
      resolvePass = resolve;
    });
    const run = jest
      .spyOn(service as any, 'runBoundedPass')
      .mockReturnValue(pass);

    const first = service.reconcileOnce();
    const second = service.reconcileOnce();
    expect(first).toBe(second);
    expect(run).toHaveBeenCalledTimes(1);
    resolvePass({ examined: 0, claimed: 0, processed: 0, skippedMissingKey: 0 });
    await expect(first).resolves.toMatchObject({ examined: 0 });
  });

  it('reports lost lease ownership without changing operation state', async () => {
    operations.findOneAndUpdate.mockResolvedValue(null);

    await expect(service.renewLease('operation-lost')).resolves.toBe(false);
    expect(operations.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ operationId: 'operation-lost' }),
      expect.any(Array),
      expect.any(Object),
    );
  });

  it('fails an invalid transition terminally with a redacted event', async () => {
    jest
      .spyOn(service as any, 'attachMissingReservationReferences')
      .mockResolvedValue(undefined);

    await (service as any).process(operation({ status: 'invalid-state' }));

    expect(events.recordIdentifierOperationTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        terminalStatus: AuthIdentifierOperationStatus.FailedTerminal,
        reasonCategory: 'identifier-operation-invalid-state',
      }),
    );
    expect(JSON.stringify(events.recordIdentifierOperationTerminal.mock.calls)).not.toContain(
      'normalizedIdentifier',
    );
    expect(operations.findOneAndUpdate).toHaveBeenCalled();
  });

  it('continues processing later claimed operations after one operation fails', async () => {
    const first = operation({ operationId: 'operation-fails' });
    const second = operation({ operationId: 'operation-recovers' });
    operations.find.mockReturnValue(query([first, second]));
    operations.findOneAndUpdate
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    const process = jest
      .spyOn(service as any, 'process')
      .mockRejectedValueOnce(new Error('transient failure'))
      .mockResolvedValueOnce(undefined);

    await expect(service.reconcileOnce()).resolves.toMatchObject({
      claimed: 2,
      processed: 1,
    });
    expect(process).toHaveBeenCalledTimes(2);
    expect(operations.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ operationId: 'operation-fails' }),
      expect.any(Array),
      expect.any(Object),
    );
    expect(operations.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ operationId: 'operation-recovers' }),
      expect.any(Array),
      expect.any(Object),
    );
  });

  it('skips an offline repair with unavailable audit material before claiming it', async () => {
    operations.find.mockReturnValue(
      query([
        operation({
          operationType: AuthIdentifierOperationType.OfflineRepair,
          manifestKeyVersion: 1,
        }),
      ]),
    );
    (policy.getKeyMaterial as jest.Mock).mockReturnValue(undefined);

    await expect(service.reconcileOnce()).resolves.toMatchObject({
      claimed: 0,
      processed: 0,
      skippedMissingKey: 1,
    });
    expect(operations.findOneAndUpdate).not.toHaveBeenCalled();
    expect(operations.updateOne).not.toHaveBeenCalled();
    expect(identifiers.updateOne).not.toHaveBeenCalled();
  });

  it('recovers applied reservations into finalization when every assignment is durable', async () => {
    const current = operation({
      status: AuthIdentifierOperationStatus.Applying,
      assignments: [
        {
          assignmentId: 'assignment-1',
          action: 'claim',
          status: 'pending',
        },
      ],
    });
    jest.spyOn(service as any, 'findReservation').mockResolvedValue({
      status: AuthIdentifierStatus.Active,
      lastOperationId: 'operation-1',
      updatedAt: new Date(),
    });

    await (service as any).recoverApplying(current);

    expect(operations.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ 'assignments.assignmentId': 'assignment-1' }),
      expect.objectContaining({ $set: expect.objectContaining({ 'assignments.$.status': 'applied' }) }),
    );
    expect(operations.updateOne).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: AuthIdentifierOperationStatus.Applying }),
      { $set: { status: AuthIdentifierOperationStatus.Finalizing } },
    );
  });

  it('compensates a pending reservation and advances a recovered operation to finalization', async () => {
    const current = operation({
      status: AuthIdentifierOperationStatus.Compensating,
      assignments: [
        {
          assignmentId: 'assignment-1',
          action: 'replace',
          status: 'pending',
        },
      ],
    });
    jest.spyOn(service as any, 'findReservation').mockResolvedValue({
      _id: new Types.ObjectId(),
      pendingOperationId: 'operation-1',
    });

    await (service as any).recoverCompensating(current);

    expect(identifiers.updateOne).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ $set: expect.objectContaining({ status: AuthIdentifierStatus.Released }) }),
    );
    expect(operations.updateOne).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: AuthIdentifierOperationStatus.Compensating }),
      { $set: { status: AuthIdentifierOperationStatus.Finalizing } },
    );
  });

  it('returns incomplete application recovery to a retryable state', async () => {
    const current = operation({
      status: AuthIdentifierOperationStatus.Applying,
      assignments: [{ assignmentId: 'assignment-1', action: 'claim', status: 'pending' }],
    });
    jest.spyOn(service as any, 'findReservation').mockResolvedValue(null);

    await (service as any).recoverApplying(current);

    expect(operations.updateOne).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: AuthIdentifierOperationStatus.Applying }),
      { $set: { status: AuthIdentifierOperationStatus.FailedRetryable } },
    );
  });

  it('returns compensation with applied assignments to a retryable state', async () => {
    await (service as any).recoverCompensating(
      operation({
        status: AuthIdentifierOperationStatus.Compensating,
        assignments: [{ assignmentId: 'assignment-1', action: 'claim', status: 'applied' }],
      }),
    );

    expect(operations.updateOne).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: AuthIdentifierOperationStatus.Compensating }),
      { $set: { status: AuthIdentifierOperationStatus.FailedRetryable } },
    );
  });
});
