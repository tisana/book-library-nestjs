import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Connection, Types } from 'mongoose';
import {
  createIdentifierModelHarness,
  createStaffModelHarness,
  deferred,
  queryResult,
} from '../../test/support/backend-coverage-fixtures';
import {
  createIdentifierOperation,
  criticalQueryResult,
} from '../../test/support/critical-auth-fixtures';
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

const staffRequester = createStaffModelHarness().document;

function operation(overrides: Record<string, unknown> = {}) {
  return createIdentifierOperation({
    operationId: 'operation-1',
    requestedBy: {
      subjectType: AuthIdentifierSubjectType.Staff,
      subjectId: staffRequester._id.toString(),
    },
    ...overrides,
  });
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

  function createReconciliationService(overrides?: {
    scheduler?: SchedulerRegistry;
    connection?: Connection;
    config?: ConfigService;
    operations?: typeof operations;
    identifiers?: typeof identifiers;
    batches?: typeof batches;
  }): AuthIdentifierReconciliationService {
    return new AuthIdentifierReconciliationService(
      overrides?.operations ?? operations,
      overrides?.identifiers ?? identifiers,
      overrides?.batches ?? batches,
      policy as AuthIdentifierRepairKeyPolicyService,
      events,
      overrides?.config ?? config,
      overrides?.scheduler,
      overrides?.connection,
    );
  }

  beforeEach(() => {
    operations = {
      find: jest.fn().mockReturnValue(criticalQueryResult([])),
      findOneAndUpdate: jest.fn().mockResolvedValue(null),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const identifierHarness = createIdentifierModelHarness();
    identifiers = {
      ...identifierHarness.model,
      find: jest.fn().mockReturnValue(criticalQueryResult([])),
      findById: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
      exists: jest.fn().mockResolvedValue(null),
    };
    batches = {
      find: jest.fn().mockReturnValue(criticalQueryResult([])),
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
    service = createReconciliationService();
  });

  it('checks a repair key before acquiring a lease and leaves data unchanged when missing', async () => {
    operations.find.mockReturnValue(
      criticalQueryResult([
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
    operations.find.mockReturnValue(criticalQueryResult([candidate]));
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
    identifiers.find.mockReturnValue(criticalQueryResult([reservation]));

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
    identifiers.find.mockReturnValue(criticalQueryResult([gate], gateCapture));
    const batchCapture: { limit?: number } = {};
    batches.find.mockReturnValue(
      criticalQueryResult([{ _id: new Types.ObjectId() }], batchCapture),
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
    identifiers.find.mockReturnValue(
      criticalQueryResult([{ _id: new Types.ObjectId() }]),
    );
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
    operations.find.mockReturnValue(criticalQueryResult([]));

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

  it('registers only a readiness probe when bootstrap has no Mongo connection', async () => {
    jest.useFakeTimers();
    const scheduler = {
      addInterval: jest.fn(),
      doesExist: jest.fn().mockReturnValue(false),
      deleteInterval: jest.fn(),
    };
    service = createReconciliationService({
      scheduler: scheduler as unknown as SchedulerRegistry,
    });

    await service.onApplicationBootstrap();

    expect(scheduler.addInterval).not.toHaveBeenCalled();
    expect(operations.find).not.toHaveBeenCalled();
    expect(operations.findOneAndUpdate).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(1);

    service.onApplicationShutdown();
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  it('invalidates stale in-flight readiness before a restarted lifecycle schedules work', async () => {
    jest.useFakeTimers();
    const staleReadiness = deferred<Record<string, unknown> | null>();
    const ready = queryResult<Record<string, unknown> | null>({
      version: '003',
    });
    const findOne = jest
      .fn()
      .mockImplementationOnce(() => staleReadiness.promise)
      .mockImplementationOnce(() => ready.exec());
    const scheduler = {
      addInterval: jest.fn(),
      doesExist: jest.fn().mockReturnValue(true),
      deleteInterval: jest.fn(),
    };
    const connection = {
      db: {
        collection: jest.fn().mockReturnValue({ findOne }),
      },
    };
    service = createReconciliationService({
      scheduler: scheduler as unknown as SchedulerRegistry,
      connection: connection as unknown as Connection,
    });

    const staleBootstrap = service.onApplicationBootstrap();
    service.onApplicationShutdown();
    const restartedBootstrap = service.onApplicationBootstrap();

    staleReadiness.resolve({ version: '003' });
    await Promise.all([staleBootstrap, restartedBootstrap]);

    expect(scheduler.addInterval).not.toHaveBeenCalled();
    expect(operations.find).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(60_000);

    expect(findOne).toHaveBeenCalledTimes(2);
    expect(scheduler.addInterval).toHaveBeenCalledTimes(1);
    expect(operations.find).toHaveBeenCalledTimes(1);

    service.onApplicationShutdown();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('never treats reconciliation as scheduled without a SchedulerRegistry', async () => {
    jest.useFakeTimers();
    const findOne = jest.fn().mockResolvedValue({ version: '003' });
    const connection = {
      db: {
        collection: jest.fn().mockReturnValue({ findOne }),
      },
    };
    service = createReconciliationService({
      connection: connection as unknown as Connection,
    });

    await service.onApplicationBootstrap();
    await service.onApplicationBootstrap();

    expect(findOne).toHaveBeenCalledTimes(2);
    expect(operations.find).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(1);

    service.onApplicationShutdown();
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  it('starts scheduled work when the public readiness probe observes the migration', async () => {
    jest.useFakeTimers();
    let migrationReady = false;
    const scheduler = {
      addInterval: jest.fn(),
      doesExist: jest.fn().mockReturnValue(true),
      deleteInterval: jest.fn(),
    };
    const connection = {
      db: {
        collection: jest.fn().mockReturnValue({
          findOne: jest.fn().mockImplementation(async () =>
            migrationReady ? { version: '003' } : null,
          ),
        }),
      },
    };
    service = createReconciliationService({
      scheduler: scheduler as unknown as SchedulerRegistry,
      connection: connection as unknown as Connection,
    });

    await service.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(scheduler.addInterval).not.toHaveBeenCalled();

    migrationReady = true;
    await jest.advanceTimersByTimeAsync(60_000);

    expect(scheduler.addInterval).toHaveBeenCalledTimes(1);
    expect(operations.find).toHaveBeenCalledTimes(1);

    service.onApplicationShutdown();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('contains a scheduled reconciliation rejection and keeps the interval owned', async () => {
    jest.useFakeTimers();
    const scheduler = {
      addInterval: jest.fn(),
      doesExist: jest.fn().mockReturnValue(true),
      deleteInterval: jest.fn(),
    };
    const connection = {
      db: {
        collection: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValue({ version: '003' }),
        }),
      },
    };
    service = createReconciliationService({
      scheduler: scheduler as unknown as SchedulerRegistry,
      connection: connection as unknown as Connection,
    });
    const reconcile = jest
      .spyOn(service, 'reconcileOnce')
      .mockResolvedValueOnce({
        examined: 0,
        claimed: 0,
        processed: 0,
        skippedMissingKey: 0,
      })
      .mockRejectedValueOnce(new Error('scheduled pass failed'));

    await service.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(60_000);

    expect(reconcile).toHaveBeenCalledTimes(2);
    expect(scheduler.deleteInterval).not.toHaveBeenCalled();

    service.onApplicationShutdown();
    expect(scheduler.deleteInterval).toHaveBeenCalledTimes(1);
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('contains a rejected startup pass after registering the schedule', async () => {
    jest.useFakeTimers();
    const scheduler = {
      addInterval: jest.fn(),
      doesExist: jest.fn().mockReturnValue(true),
      deleteInterval: jest.fn(),
    };
    const connection = {
      db: {
        collection: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValue({ version: '003' }),
        }),
      },
    };
    service = createReconciliationService({
      scheduler: scheduler as unknown as SchedulerRegistry,
      connection: connection as unknown as Connection,
    });
    jest
      .spyOn(service, 'reconcileOnce')
      .mockRejectedValueOnce(new Error('startup pass failed'));

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(scheduler.addInterval).toHaveBeenCalledTimes(1);

    service.onApplicationShutdown();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('does not register work after shutdown wins a migration-readiness race', async () => {
    jest.useFakeTimers();
    const readiness = deferred<Record<string, unknown> | null>();
    const scheduler = {
      addInterval: jest.fn(),
      doesExist: jest.fn().mockReturnValue(false),
      deleteInterval: jest.fn(),
    };
    const connection = {
      db: {
        collection: jest.fn().mockReturnValue({
          findOne: jest.fn().mockReturnValue(readiness.promise),
        }),
      },
    };
    service = createReconciliationService({
      scheduler: scheduler as unknown as SchedulerRegistry,
      connection: connection as unknown as Connection,
    });

    const bootstrap = service.onApplicationBootstrap();
    service.onApplicationShutdown();
    readiness.resolve({ version: '003' });
    await bootstrap;

    expect(scheduler.addInterval).not.toHaveBeenCalled();
    expect(operations.findOneAndUpdate).not.toHaveBeenCalled();

    service.onApplicationShutdown();
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  it('does not delete a schedule no longer owned by this service on shutdown', async () => {
    jest.useFakeTimers();
    const scheduler = {
      addInterval: jest.fn(),
      doesExist: jest.fn().mockReturnValue(false),
      deleteInterval: jest.fn(),
    };
    const connection = {
      db: {
        collection: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValue({ version: '003' }),
        }),
      },
    };
    service = createReconciliationService({
      scheduler: scheduler as unknown as SchedulerRegistry,
      connection: connection as unknown as Connection,
    });

    await service.onApplicationBootstrap();
    service.onApplicationShutdown();
    service.onApplicationShutdown();

    expect(scheduler.addInterval).toHaveBeenCalledTimes(1);
    expect(scheduler.doesExist).toHaveBeenCalledTimes(1);
    expect(scheduler.deleteInterval).not.toHaveBeenCalled();

    jest.clearAllTimers();
    jest.useRealTimers();
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

  it('serializes concurrent ready checks into one schedule and startup pass', async () => {
    let resolveReady!: (value: unknown) => void;
    const pending = new Promise((resolve) => {
      resolveReady = resolve;
    });
    const registry = {
      addInterval: jest.fn(),
      doesExist: jest.fn().mockReturnValue(true),
      deleteInterval: jest.fn(),
    };
    const concurrent = new (AuthIdentifierReconciliationService as any)(
      operations, identifiers, batches, policy, events, config, registry,
      { db: { collection: jest.fn().mockReturnValue({ findOne: jest.fn().mockReturnValue(pending) }) } },
    );
    const reconcile = jest.spyOn(concurrent, 'reconcileOnce').mockResolvedValue({});

    const first = concurrent.startWhenMigrationsReady();
    const second = concurrent.startWhenMigrationsReady();
    resolveReady({ version: '003' });
    await Promise.all([first, second]);

    expect(registry.addInterval).toHaveBeenCalledTimes(1);
    expect(reconcile).toHaveBeenCalledTimes(1);
    concurrent.onApplicationShutdown();
  });

  it('does not start after shutdown when an in-flight readiness query resolves', async () => {
    let resolveReady!: (value: unknown) => void;
    const pending = new Promise((resolve) => { resolveReady = resolve; });
    const registry = { addInterval: jest.fn(), doesExist: jest.fn().mockReturnValue(true), deleteInterval: jest.fn() };
    const late = new (AuthIdentifierReconciliationService as any)(
      operations, identifiers, batches, policy, events, config, registry,
      { db: { collection: jest.fn().mockReturnValue({ findOne: jest.fn().mockReturnValue(pending) }) } },
    );
    const reconcile = jest.spyOn(late, 'reconcileOnce');
    const check = late.startWhenMigrationsReady();
    late.onApplicationShutdown();
    resolveReady({ version: '003' });
    await check;

    expect(registry.addInterval).not.toHaveBeenCalled();
    expect(reconcile).not.toHaveBeenCalled();
  });

  it('contains readiness query failures and allows a later successful probe', async () => {
    const findOne = jest
      .fn()
      .mockRejectedValueOnce(new Error('mongo unavailable'))
      .mockResolvedValueOnce({ version: '003' });
    const registry = { addInterval: jest.fn(), doesExist: jest.fn().mockReturnValue(true), deleteInterval: jest.fn() };
    const retryable = new (AuthIdentifierReconciliationService as any)(
      operations, identifiers, batches, policy, events, config, registry,
      { db: { collection: jest.fn().mockReturnValue({ findOne }) } },
    );
    const reconcile = jest.spyOn(retryable, 'reconcileOnce').mockResolvedValue({});

    await expect(retryable.runReadinessProbe()).resolves.toBeUndefined();
    expect(registry.addInterval).not.toHaveBeenCalled();
    await expect(retryable.runReadinessProbe()).resolves.toBeUndefined();
    expect(registry.addInterval).toHaveBeenCalledTimes(1);
    expect(reconcile).toHaveBeenCalledTimes(1);
    retryable.onApplicationShutdown();
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

  it('counts a lost claim as examined without claiming or processing it', async () => {
    const lost = operation({
      _id: new Types.ObjectId('507f1f77bcf86cd799439031'),
      operationId: 'operation-lost',
    });
    const acquired = operation({
      _id: new Types.ObjectId('507f1f77bcf86cd799439032'),
      operationId: 'operation-acquired',
    });
    operations.find.mockReturnValue(criticalQueryResult([lost, acquired]));
    operations.findOneAndUpdate
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(acquired);

    await expect(service.reconcileOnce()).resolves.toEqual({
      examined: 2,
      claimed: 1,
      processed: 1,
      skippedMissingKey: 0,
    });
    expect(operations.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(
      operations.updateOne.mock.calls.filter(([, update]: unknown[]) =>
        Array.isArray(update),
      ),
    ).toHaveLength(1);
  });

  it('caps claims at the configured batch size and releases every acquired lease', async () => {
    const candidates = [
      operation({
        _id: new Types.ObjectId('507f1f77bcf86cd799439041'),
        operationId: 'operation-1',
      }),
      operation({
        _id: new Types.ObjectId('507f1f77bcf86cd799439042'),
        operationId: 'operation-2',
      }),
      operation({
        _id: new Types.ObjectId('507f1f77bcf86cd799439043'),
        operationId: 'operation-3',
      }),
      operation({
        _id: new Types.ObjectId('507f1f77bcf86cd799439044'),
        operationId: 'operation-4',
      }),
    ];
    const capture: { limit?: number } = {};
    operations.find.mockReturnValue(criticalQueryResult(candidates, capture));
    operations.findOneAndUpdate.mockImplementation(
      async (filter: { _id: Types.ObjectId }) =>
        candidates.find((candidate) => candidate._id.equals(filter._id)) ?? null,
    );

    await expect(service.reconcileOnce()).resolves.toEqual({
      examined: 4,
      claimed: 2,
      processed: 2,
      skippedMissingKey: 0,
    });

    expect(capture.limit).toBe(4);
    expect(operations.findOneAndUpdate).toHaveBeenCalledTimes(2);
    const releases = operations.updateOne.mock.calls.filter(
      ([, update]: unknown[]) => Array.isArray(update),
    );
    expect(releases).toHaveLength(2);
    expect(releases.map(([filter]: [{ operationId: string }]) => filter.operationId)).toEqual([
      'operation-1',
      'operation-2',
    ]);
  });

  it('processes claimed terminal cleanup and releases its lease through the public pass', async () => {
    const terminal = operation({
      _id: new Types.ObjectId('507f1f77bcf86cd799439045'),
      operationId: 'operation-terminal-cleanup',
      status: AuthIdentifierOperationStatus.Completed,
      cleanupStatus: AuthIdentifierOperationCleanupStatus.Pending,
      terminalEventId: 'event-terminal-cleanup',
      terminalEventRecordedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    operations.find.mockReturnValue(criticalQueryResult([terminal]));
    operations.findOneAndUpdate.mockResolvedValue(terminal);

    await expect(service.reconcileOnce()).resolves.toEqual({
      examined: 1,
      claimed: 1,
      processed: 1,
      skippedMissingKey: 0,
    });
    expect(
      operations.updateOne.mock.calls.filter(([, update]: unknown[]) =>
        Array.isArray(update),
      ),
    ).toHaveLength(1);
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
    operations.find.mockReturnValue(criticalQueryResult([first, second]));
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
      criticalQueryResult([
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
