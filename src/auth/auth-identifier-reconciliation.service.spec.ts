import { Logger } from '@nestjs/common';
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
  AuthIdentifierOperationResultOutcome,
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

function assignment(overrides: Record<string, unknown> = {}) {
  return {
    assignmentId: 'assignment-1',
    subjectType: AuthIdentifierSubjectType.Member,
    subjectId: 'member-1',
    action: AuthIdentifierAssignmentAction.Claim,
    status: AuthIdentifierAssignmentStatus.Pending,
    ...overrides,
  };
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
      'auth.identifierLeaseSeconds': 301,
      'auth.identifierReconciliationBatchSize': 2,
      'auth.identifierMaxOperationAssignments': 2,
      'auth.identifierOperationRetentionDays': 91,
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

  it('reports an offline repair key available only when policy and material agree', () => {
    const offlineRepair = operation({
      operationType: AuthIdentifierOperationType.OfflineRepair,
      manifestKeyVersion: 1,
    });

    expect((service as any).repairKeyAvailable(offlineRepair)).toBe(true);
    expect(policy.repairWorkerDecision).toHaveBeenCalledWith(1);
    expect(policy.getKeyMaterial).toHaveBeenCalledWith(1);

    (policy.repairWorkerDecision as jest.Mock).mockReturnValue({
      allowed: false,
    });
    expect((service as any).repairKeyAvailable(offlineRepair)).toBe(false);
  });

  it('uses exact legacy correlation keying, secret decoding, and duration defaults', () => {
    const legacyConfig = {
      get: jest.fn((key: string) =>
        key === 'auth.auditCorrelationKeyVersion' ? 7 : undefined,
      ),
    } as unknown as ConfigService;
    (policy.getKeyMaterial as jest.Mock).mockReturnValue(
      Buffer.from([1, 2, 3]),
    );
    const defaults = createReconciliationService({ config: legacyConfig });

    expect((defaults as any).correlationFor('member@example.test')).toEqual({
      hash: expect.any(String),
      version: 7,
    });
    expect(policy.getKeyMaterial).toHaveBeenCalledWith(7);
    expect((defaults as any).decodeConfiguredSecret('AQID')).toEqual(
      Buffer.from([1, 2, 3]),
    );
    expect((defaults as any).decodeConfiguredSecret('not base64!')).toEqual(
      Buffer.from('not base64!', 'utf8'),
    );
    expect((defaults as any).leaseSeconds).toBe(300);
    expect((defaults as any).retentionDays).toBe(90);
  });

  it('uses MongoDB time for atomic lease acquisition and renewal', async () => {
    const now = new Date('2026-07-15T00:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    const candidate = operation();
    const candidateCapture: { sort?: unknown; limit?: number } = {};
    operations.find.mockReturnValue(
      criticalQueryResult([candidate], candidateCapture),
    );
    operations.findOneAndUpdate
      .mockResolvedValueOnce(candidate)
      .mockResolvedValueOnce(candidate);

    await service.reconcileOnce();
    await expect(service.renewLease(candidate.operationId)).resolves.toBe(true);

    expect(operations.find).toHaveBeenCalledWith({
      $and: [
        {
          $or: [
            {
              status: {
                $in: [
                  AuthIdentifierOperationStatus.Pending,
                  AuthIdentifierOperationStatus.Applying,
                  AuthIdentifierOperationStatus.Compensating,
                  AuthIdentifierOperationStatus.Finalizing,
                  AuthIdentifierOperationStatus.FailedRetryable,
                ],
              },
            },
            {
              status: {
                $in: [
                  AuthIdentifierOperationStatus.Completed,
                  AuthIdentifierOperationStatus.FailedTerminal,
                ],
              },
              cleanupStatus: AuthIdentifierOperationCleanupStatus.Pending,
            },
          ],
        },
        {
          $or: [
            { leaseExpiresAt: { $exists: false } },
            { leaseExpiresAt: { $lte: new Date(now.getTime() - 5_000) } },
          ],
        },
      ],
    });
    expect(candidateCapture).toEqual({
      sort: { updatedAt: 1, _id: 1 },
      limit: 4,
    });

    const claimCall = operations.findOneAndUpdate.mock.calls[0];
    expect(claimCall).toEqual([
      {
        _id: candidate._id,
        $and: [
          {
            $or: [
              {
                status: {
                  $in: [
                    AuthIdentifierOperationStatus.Pending,
                    AuthIdentifierOperationStatus.Applying,
                    AuthIdentifierOperationStatus.Compensating,
                    AuthIdentifierOperationStatus.Finalizing,
                    AuthIdentifierOperationStatus.FailedRetryable,
                  ],
                },
              },
              {
                status: {
                  $in: [
                    AuthIdentifierOperationStatus.Completed,
                    AuthIdentifierOperationStatus.FailedTerminal,
                  ],
                },
                cleanupStatus: AuthIdentifierOperationCleanupStatus.Pending,
              },
            ],
          },
          {
            $or: [
              { leaseExpiresAt: { $exists: false } },
              {
                $expr: {
                  $lte: [
                    '$leaseExpiresAt',
                    {
                      $dateSubtract: {
                        startDate: '$$NOW',
                        unit: 'second',
                        amount: 5,
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
      [
        {
          $set: {
            leaseOwner: expect.any(String),
            leaseExpiresAt: {
              $dateAdd: {
                startDate: '$$NOW',
                unit: 'second',
                amount: 301,
              },
            },
            updatedAt: '$$NOW',
          },
        },
      ],
      { returnDocument: 'after', updatePipeline: true },
    ]);
    const renewalCall = operations.findOneAndUpdate.mock.calls[1];
    expect(renewalCall).toEqual([
      {
        operationId: candidate.operationId,
        leaseOwner: expect.any(String),
        $expr: { $gt: ['$leaseExpiresAt', '$$NOW'] },
      },
      [
        {
          $set: {
            leaseExpiresAt: {
              $dateAdd: {
                startDate: '$$NOW',
                unit: 'second',
                amount: 301,
              },
            },
            updatedAt: '$$NOW',
          },
        },
      ],
      { returnDocument: 'after', updatePipeline: true },
    ]);
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
    const discoveryCapture: { limit?: number } = {};
    identifiers.find.mockReturnValue(
      criticalQueryResult([reservation], discoveryCapture),
    );

    await (service as any).attachMissingReservationReferences(
      operation({ assignments: [assignment] }),
    );

    expect(identifiers.find).toHaveBeenCalledWith({
      pendingOperationId: 'operation-1',
    });
    expect(discoveryCapture.limit).toBe(3);
    expect(operations.updateOne.mock.calls[0][0]).toEqual({
      operationId: 'operation-1',
      'assignments.assignmentId': 'assignment-1',
      'assignments.targetReservationId': { $exists: false },
      leaseOwner: expect.any(String),
    });
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

  it('moves an operation to retryable failure when owned reservations exceed the assignment cap', async () => {
    const discoveryCapture: { limit?: number } = {};
    identifiers.find.mockReturnValue(
      criticalQueryResult(
        [
          { _id: new Types.ObjectId() },
          { _id: new Types.ObjectId() },
          { _id: new Types.ObjectId() },
        ],
        discoveryCapture,
      ),
    );

    await (service as any).attachMissingReservationReferences(
      operation({ status: AuthIdentifierOperationStatus.Applying }),
    );

    expect(discoveryCapture.limit).toBe(3);
    expect(operations.updateOne).toHaveBeenCalledWith(
      {
        operationId: 'operation-1',
        status: AuthIdentifierOperationStatus.Applying,
        leaseOwner: expect.any(String),
      },
      { $set: { status: AuthIdentifierOperationStatus.FailedRetryable } },
    );
  });

  it('attaches exactly the maximum owned reservations without treating the boundary as over-cap', async () => {
    const reservations = [
      {
        _id: new Types.ObjectId(),
        normalizedIdentifier: 'first@example.test',
        subjectType: AuthIdentifierSubjectType.Member,
        subjectId: 'member-first',
        pendingAction: AuthIdentifierPendingAction.Claim,
      },
      {
        _id: new Types.ObjectId(),
        normalizedIdentifier: 'second@example.test',
        subjectType: AuthIdentifierSubjectType.Member,
        subjectId: 'member-second',
        pendingAction: AuthIdentifierPendingAction.Claim,
      },
    ];
    identifiers.find.mockReturnValue(criticalQueryResult(reservations));

    await (service as any).attachMissingReservationReferences(
      operation({
        assignments: [
          assignment({
            assignmentId: 'assignment-first',
            subjectId: 'member-first',
          }),
          assignment({
            assignmentId: 'assignment-second',
            subjectId: 'member-second',
          }),
        ],
      }),
    );

    expect(operations.updateOne).toHaveBeenCalledTimes(2);
    expect(operations.updateOne.mock.calls.map((call) => call[0])).toEqual([
      expect.objectContaining({
        'assignments.assignmentId': 'assignment-first',
      }),
      expect.objectContaining({
        'assignments.assignmentId': 'assignment-second',
      }),
    ]);
  });

  it.each([
    [
      'an assignment already linked',
      { targetReservationId: new Types.ObjectId() },
      {},
    ],
    [
      'a subject-type mismatch',
      {},
      { subjectType: AuthIdentifierSubjectType.Staff },
    ],
    ['a subject-id mismatch', {}, { subjectId: 'different-member' }],
    [
      'an action mismatch',
      {},
      { pendingAction: AuthIdentifierPendingAction.Release },
    ],
  ])(
    'does not attach a discovered reservation with %s',
    async (_case, assignmentOverrides, reservationOverrides) => {
      identifiers.find.mockReturnValue(
        criticalQueryResult([
          {
            _id: new Types.ObjectId(),
            normalizedIdentifier: 'candidate@example.test',
            subjectType: AuthIdentifierSubjectType.Member,
            subjectId: 'member-1',
            pendingAction: AuthIdentifierPendingAction.Claim,
            pendingOperationId: 'operation-1',
            ...reservationOverrides,
          },
        ]),
      );

      await (service as any).attachMissingReservationReferences(
        operation({ assignments: [assignment(assignmentOverrides)] }),
      );

      expect(operations.updateOne).not.toHaveBeenCalled();
    },
  );

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

  it('finds an assignment reservation by exact operation-owned identity', async () => {
    const reservation = { _id: new Types.ObjectId() };
    identifiers.findOne.mockResolvedValue(reservation);
    const candidate = operation({ operationId: 'operation-owned-reservation' });
    const pending = assignment({
      subjectType: AuthIdentifierSubjectType.Member,
      subjectId: 'member-owned',
      action: AuthIdentifierAssignmentAction.Replace,
    });

    await expect(
      (service as any).findReservation(candidate, pending),
    ).resolves.toBe(reservation);

    expect(identifiers.findOne).toHaveBeenCalledWith({
      pendingOperationId: 'operation-owned-reservation',
      subjectType: AuthIdentifierSubjectType.Member,
      subjectId: 'member-owned',
      pendingAction: AuthIdentifierPendingAction.Replace,
    });
  });

  it('does not persist a no-op transition and releases only its owned lease', async () => {
    await (service as any).transition(
      'operation-noop-transition',
      AuthIdentifierOperationStatus.Applying,
      AuthIdentifierOperationStatus.Applying,
    );
    expect(operations.updateOne).not.toHaveBeenCalled();

    await (service as any).releaseLease('operation-noop-transition');
    expect(operations.updateOne).toHaveBeenCalledWith(
      {
        operationId: 'operation-noop-transition',
        leaseOwner: expect.any(String),
      },
      [
        {
          $set: { leaseExpiresAt: '$$NOW', updatedAt: '$$NOW' },
        },
      ],
      { updatePipeline: true },
    );
  });

  it.each([
    ['missing reservation', null],
    [
      'wrong durable status',
      { status: AuthIdentifierStatus.Released, lastOperationId: 'operation-1' },
    ],
    [
      'wrong operation owner',
      {
        status: AuthIdentifierStatus.Active,
        lastOperationId: 'other-operation',
      },
    ],
  ])('returns incomplete application recovery for %s', async (_case, found) => {
    const candidate = operation({
      status: AuthIdentifierOperationStatus.Applying,
      assignments: [assignment()],
    });
    jest.spyOn(service as any, 'findReservation').mockResolvedValue(found);

    await (service as any).recoverApplying(candidate);

    expect(operations.updateOne).toHaveBeenCalledWith(
      {
        operationId: 'operation-1',
        status: AuthIdentifierOperationStatus.Applying,
        leaseOwner: expect.any(String),
      },
      { $set: { status: AuthIdentifierOperationStatus.FailedRetryable } },
    );
  });

  it('recovers a durable release assignment only from released state owned by the operation', async () => {
    const updatedAt = new Date('2026-07-15T00:00:00.000Z');
    const candidate = operation({
      status: AuthIdentifierOperationStatus.Applying,
      assignments: [
        assignment({ action: AuthIdentifierAssignmentAction.Release }),
      ],
    });
    jest.spyOn(service as any, 'findReservation').mockResolvedValue({
      status: AuthIdentifierStatus.Released,
      lastOperationId: 'operation-1',
      updatedAt,
    });

    await (service as any).recoverApplying(candidate);

    expect(operations.updateOne).toHaveBeenNthCalledWith(
      1,
      {
        operationId: 'operation-1',
        'assignments.assignmentId': 'assignment-1',
        leaseOwner: expect.any(String),
      },
      {
        $set: {
          'assignments.$.status': 'applied',
          'assignments.$.appliedAt': updatedAt,
        },
      },
    );
  });

  it.each([
    ['missing reservation', null],
    ['wrong operation owner', { pendingOperationId: 'other-operation' }],
  ])(
    'returns incomplete compensation recovery for %s',
    async (_case, found) => {
      const candidate = operation({
        status: AuthIdentifierOperationStatus.Compensating,
        assignments: [assignment()],
      });
      jest.spyOn(service as any, 'findReservation').mockResolvedValue(found);

      await (service as any).recoverCompensating(candidate);

      expect(identifiers.updateOne).not.toHaveBeenCalled();
      expect(operations.updateOne).toHaveBeenCalledWith(
        {
          operationId: 'operation-1',
          status: AuthIdentifierOperationStatus.Compensating,
          leaseOwner: expect.any(String),
        },
        { $set: { status: AuthIdentifierOperationStatus.FailedRetryable } },
      );
    },
  );

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
          findOne: jest
            .fn()
            .mockImplementation(async () =>
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
      operations,
      identifiers,
      batches,
      policy,
      events,
      config,
      registry,
      {
        db: {
          collection: jest
            .fn()
            .mockReturnValue({ findOne: jest.fn().mockReturnValue(pending) }),
        },
      },
    );
    const reconcile = jest
      .spyOn(concurrent, 'reconcileOnce')
      .mockResolvedValue({});

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
    const pending = new Promise((resolve) => {
      resolveReady = resolve;
    });
    const registry = {
      addInterval: jest.fn(),
      doesExist: jest.fn().mockReturnValue(true),
      deleteInterval: jest.fn(),
    };
    const late = new (AuthIdentifierReconciliationService as any)(
      operations,
      identifiers,
      batches,
      policy,
      events,
      config,
      registry,
      {
        db: {
          collection: jest
            .fn()
            .mockReturnValue({ findOne: jest.fn().mockReturnValue(pending) }),
        },
      },
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
    const registry = {
      addInterval: jest.fn(),
      doesExist: jest.fn().mockReturnValue(true),
      deleteInterval: jest.fn(),
    };
    const retryable = new (AuthIdentifierReconciliationService as any)(
      operations,
      identifiers,
      batches,
      policy,
      events,
      config,
      registry,
      { db: { collection: jest.fn().mockReturnValue({ findOne }) } },
    );
    const reconcile = jest
      .spyOn(retryable, 'reconcileOnce')
      .mockResolvedValue({});

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
    resolvePass({
      examined: 0,
      claimed: 0,
      processed: 0,
      skippedMissingKey: 0,
    });
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
        candidates.find((candidate) => candidate._id.equals(filter._id)) ??
        null,
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
    expect(
      releases.map(([filter]: [{ operationId: string }]) => filter.operationId),
    ).toEqual(['operation-1', 'operation-2']);
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

    expect(events.recordIdentifierOperationTerminal).toHaveBeenCalledWith({
      operationId: 'operation-1',
      operationType: AuthIdentifierOperationType.Claim,
      terminalStatus: AuthIdentifierOperationStatus.FailedTerminal,
      actor: {
        actorType: 'staff',
        actorId: staffRequester._id.toString(),
      },
      outcome: 'failure',
      reasonCategory: 'identifier-operation-invalid-state',
    });
    expect(
      JSON.stringify(events.recordIdentifierOperationTerminal.mock.calls),
    ).not.toContain('normalizedIdentifier');
    expect(operations.findOneAndUpdate).toHaveBeenCalledWith(
      {
        operationId: 'operation-1',
        status: 'invalid-state',
        leaseOwner: expect.any(String),
      },
      [
        {
          $set: {
            status: AuthIdentifierOperationStatus.FailedTerminal,
            result: {
              outcome: 'failure',
              reasonCategory: 'identifier-operation-invalid-state',
              httpStatus: 409,
            },
            terminalEventId: 'auth-identifier-operation:operation-1:completed',
            terminalEventRecordedAt: '$$NOW',
            completedAt: '$$NOW',
            expiresAt: {
              $dateAdd: {
                startDate: '$$NOW',
                unit: 'day',
                amount: 91,
              },
            },
            updatedAt: '$$NOW',
          },
        },
      ],
      { returnDocument: 'after', updatePipeline: true },
    );
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
      expect.objectContaining({
        $set: expect.objectContaining({ 'assignments.$.status': 'applied' }),
      }),
    );
    expect(operations.updateOne).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: AuthIdentifierOperationStatus.Applying,
      }),
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
      expect.objectContaining({
        $set: expect.objectContaining({
          status: AuthIdentifierStatus.Released,
        }),
      }),
    );
    expect(operations.updateOne).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: AuthIdentifierOperationStatus.Compensating,
      }),
      { $set: { status: AuthIdentifierOperationStatus.Finalizing } },
    );
  });

  it('returns incomplete application recovery to a retryable state', async () => {
    const current = operation({
      status: AuthIdentifierOperationStatus.Applying,
      assignments: [
        { assignmentId: 'assignment-1', action: 'claim', status: 'pending' },
      ],
    });
    jest.spyOn(service as any, 'findReservation').mockResolvedValue(null);

    await (service as any).recoverApplying(current);

    expect(operations.updateOne).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: AuthIdentifierOperationStatus.Applying,
      }),
      { $set: { status: AuthIdentifierOperationStatus.FailedRetryable } },
    );
  });

  it('returns compensation with applied assignments to a retryable state', async () => {
    await (service as any).recoverCompensating(
      operation({
        status: AuthIdentifierOperationStatus.Compensating,
        assignments: [
          { assignmentId: 'assignment-1', action: 'claim', status: 'applied' },
        ],
      }),
    );

    expect(operations.updateOne).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: AuthIdentifierOperationStatus.Compensating,
      }),
      { $set: { status: AuthIdentifierOperationStatus.FailedRetryable } },
    );
  });

  it('contains a real processing failure, logs its fixed category, and releases the exact lease', async () => {
    const candidate = operation({ operationId: 'operation-contained-failure' });
    const failedDiscovery = criticalQueryResult([]);
    (failedDiscovery.exec as jest.Mock).mockRejectedValue(
      new Error('identifier query failed'),
    );
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    operations.find.mockReturnValueOnce(criticalQueryResult([candidate]));
    operations.findOneAndUpdate.mockResolvedValueOnce(candidate);
    identifiers.find.mockReturnValueOnce(failedDiscovery);

    await expect(service.reconcileOnce()).resolves.toEqual({
      examined: 1,
      claimed: 1,
      processed: 0,
      skippedMissingKey: 0,
    });

    expect(warn).toHaveBeenCalledWith(
      'Auth identifier reconciliation operation failed',
    );
    expect(operations.updateOne).toHaveBeenCalledWith(
      {
        operationId: 'operation-contained-failure',
        leaseOwner: expect.any(String),
      },
      [{ $set: { leaseExpiresAt: '$$NOW', updatedAt: '$$NOW' } }],
      { updatePipeline: true },
    );
  });

  it('dispatches a pending operation through the exact Applying transition', async () => {
    const candidate = operation({
      operationId: 'operation-pending-dispatch',
      status: AuthIdentifierOperationStatus.Pending,
    });
    operations.find.mockReturnValueOnce(criticalQueryResult([candidate]));
    operations.findOneAndUpdate.mockResolvedValueOnce(candidate);
    identifiers.find.mockReturnValueOnce(criticalQueryResult([]));

    await expect(service.reconcileOnce()).resolves.toMatchObject({
      claimed: 1,
      processed: 1,
    });

    expect(operations.updateOne).toHaveBeenCalledWith(
      {
        operationId: 'operation-pending-dispatch',
        status: AuthIdentifierOperationStatus.Pending,
        leaseOwner: expect.any(String),
      },
      { $set: { status: AuthIdentifierOperationStatus.Applying } },
    );
  });

  it('records a member actor when an invalid member-owned operation fails terminally', async () => {
    const candidate = operation({
      operationId: 'operation-invalid-member',
      status: 'invalid-state',
      requestedBy: {
        subjectType: AuthIdentifierSubjectType.Member,
        subjectId: 'member-requester',
      },
    });

    await (service as any).process(candidate);

    expect(events.recordIdentifierOperationTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'operation-invalid-member',
        actor: { actorType: 'member', actorId: 'member-requester' },
      }),
    );
  });

  it('compensates pending assignments in reverse with exact owned assignment writes', async () => {
    const firstReservationId = new Types.ObjectId('507f1f77bcf86cd799439061');
    const secondReservationId = new Types.ObjectId('507f1f77bcf86cd799439062');
    const candidate = operation({
      operationId: 'operation-reverse-compensation',
      status: AuthIdentifierOperationStatus.Compensating,
      assignments: [
        assignment({
          assignmentId: 'assignment-first',
          targetReservationId: firstReservationId,
        }),
        assignment({
          assignmentId: 'assignment-second',
          targetReservationId: secondReservationId,
        }),
      ],
    });
    identifiers.findById.mockImplementation(
      async (reservationId: Types.ObjectId) => ({
        _id: reservationId,
        pendingOperationId: candidate.operationId,
      }),
    );

    await (service as any).recoverCompensating(candidate);

    expect(
      identifiers.updateOne.mock.calls.map(
        ([filter]: [{ _id: Types.ObjectId }]) => filter._id,
      ),
    ).toEqual([secondReservationId, firstReservationId]);
    expect(operations.updateOne.mock.calls.slice(0, 2)).toEqual([
      [
        {
          operationId: 'operation-reverse-compensation',
          'assignments.assignmentId': 'assignment-second',
          leaseOwner: expect.any(String),
        },
        { $set: { 'assignments.$.status': 'compensated' } },
      ],
      [
        {
          operationId: 'operation-reverse-compensation',
          'assignments.assignmentId': 'assignment-first',
          leaseOwner: expect.any(String),
        },
        { $set: { 'assignments.$.status': 'compensated' } },
      ],
    ]);
  });

  it('does not look up or compensate an assignment already durably applied', async () => {
    const candidate = operation({
      operationId: 'operation-applied-compensation',
      status: AuthIdentifierOperationStatus.Compensating,
      assignments: [
        assignment({ status: AuthIdentifierAssignmentStatus.Applied }),
      ],
    });

    await (service as any).recoverCompensating(candidate);

    expect(identifiers.findById).not.toHaveBeenCalled();
    expect(identifiers.findOne).not.toHaveBeenCalled();
    expect(identifiers.updateOne).not.toHaveBeenCalled();
    expect(operations.updateOne).toHaveBeenCalledTimes(1);
    expect(operations.updateOne).toHaveBeenCalledWith(
      {
        operationId: 'operation-applied-compensation',
        status: AuthIdentifierOperationStatus.Compensating,
        leaseOwner: expect.any(String),
      },
      { $set: { status: AuthIdentifierOperationStatus.FailedRetryable } },
    );
  });

  it('treats mixed compensated and applied finalization as a successful recovery', async () => {
    const candidate = operation({
      operationId: 'operation-mixed-finalization',
      status: AuthIdentifierOperationStatus.Finalizing,
      cleanupStatus: AuthIdentifierOperationCleanupStatus.NotRequired,
      assignments: [
        assignment({
          assignmentId: 'assignment-compensated',
          status: AuthIdentifierAssignmentStatus.Compensated,
        }),
        assignment({
          assignmentId: 'assignment-applied',
          status: AuthIdentifierAssignmentStatus.Applied,
        }),
      ],
    });

    await (service as any).finalize(candidate);

    expect(events.recordIdentifierOperationTerminal).toHaveBeenCalledWith({
      operationId: 'operation-mixed-finalization',
      operationType: AuthIdentifierOperationType.Claim,
      terminalStatus: AuthIdentifierOperationStatus.Completed,
      actor: {
        actorType: 'staff',
        actorId: staffRequester._id.toString(),
      },
      outcome: 'success',
      reasonCategory: 'identifier-operation-recovered',
    });
    expect(operations.findOneAndUpdate).toHaveBeenCalledWith(
      {
        operationId: 'operation-mixed-finalization',
        status: AuthIdentifierOperationStatus.Finalizing,
        leaseOwner: expect.any(String),
      },
      [
        {
          $set: {
            status: AuthIdentifierOperationStatus.Completed,
            terminalEventId: 'auth-identifier-operation:operation-1:completed',
            terminalEventRecordedAt: '$$NOW',
            completedAt: '$$NOW',
            updatedAt: '$$NOW',
            expiresAt: {
              $dateAdd: {
                startDate: '$$NOW',
                unit: 'day',
                amount: 91,
              },
            },
          },
        },
      ],
      { returnDocument: 'after', updatePipeline: true },
    );
  });

  it('emits exact bounded cleanup queries and terminal parent retention when no work remains', async () => {
    const candidate = operation({
      operationId: 'operation-empty-cleanup',
      status: AuthIdentifierOperationStatus.Completed,
      cleanupStatus: AuthIdentifierOperationCleanupStatus.Pending,
      terminalEventId: 'event-empty-cleanup',
      terminalEventRecordedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    await (service as any).cleanup(candidate);

    const gatedQuery = identifiers.find.mock.results[0].value;
    const batchQuery = batches.find.mock.results[0].value;
    expect(gatedQuery.select).toHaveBeenCalledWith({ _id: 1 });
    expect(gatedQuery.limit).toHaveBeenCalledWith(2);
    expect(batchQuery.select).toHaveBeenCalledWith({ _id: 1 });
    expect(batchQuery.limit).toHaveBeenCalledWith(2);
    expect(identifiers.updateMany).not.toHaveBeenCalled();
    expect(batches.updateMany).not.toHaveBeenCalled();
    expect(operations.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      {
        operationId: 'operation-empty-cleanup',
        status: {
          $in: [
            AuthIdentifierOperationStatus.Completed,
            AuthIdentifierOperationStatus.FailedTerminal,
          ],
        },
        cleanupStatus: AuthIdentifierOperationCleanupStatus.Pending,
        terminalEventId: { $exists: true },
        terminalEventRecordedAt: { $exists: true },
        leaseOwner: expect.any(String),
      },
      [
        {
          $set: {
            cleanupStatus: AuthIdentifierOperationCleanupStatus.Completed,
            expiresAt: {
              $dateAdd: {
                startDate: '$$NOW',
                unit: 'day',
                amount: 91,
              },
            },
            updatedAt: '$$NOW',
          },
        },
      ],
      { returnDocument: 'after', updatePipeline: true },
    );
  });

  describe('public recovery matrix', () => {
    it('does not run cleanup mutations for a clean terminal operation', async () => {
      const candidate = operation({
        status: AuthIdentifierOperationStatus.Completed,
        cleanupStatus: AuthIdentifierOperationCleanupStatus.Completed,
      });
      operations.find.mockReturnValueOnce(criticalQueryResult([candidate]));
      operations.findOneAndUpdate.mockResolvedValueOnce(candidate);

      await expect(service.reconcileOnce()).resolves.toEqual({
        examined: 1,
        claimed: 1,
        processed: 1,
        skippedMissingKey: 0,
      });

      expect(identifiers.find).not.toHaveBeenCalled();
      expect(identifiers.updateMany).not.toHaveBeenCalled();
      expect(batches.find).not.toHaveBeenCalled();
      expect(batches.updateMany).not.toHaveBeenCalled();
      expect(operations.findOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(operations.updateOne).toHaveBeenCalledTimes(1);
    });

    it('retries toward compensation when any assignment is compensated and toward application otherwise', async () => {
      const compensating = operation({
        _id: new Types.ObjectId('507f1f77bcf86cd799439051'),
        operationId: 'operation-retry-compensating',
        status: AuthIdentifierOperationStatus.FailedRetryable,
        assignments: [
          assignment({
            assignmentId: 'assignment-compensated',
            status: AuthIdentifierAssignmentStatus.Compensated,
          }),
        ],
      });
      const applying = operation({
        _id: new Types.ObjectId('507f1f77bcf86cd799439052'),
        operationId: 'operation-retry-applying',
        status: AuthIdentifierOperationStatus.FailedRetryable,
        assignments: [assignment({ assignmentId: 'assignment-pending' })],
      });
      operations.find.mockReturnValueOnce(
        criticalQueryResult([compensating, applying]),
      );
      operations.findOneAndUpdate
        .mockResolvedValueOnce(compensating)
        .mockResolvedValueOnce(applying);
      identifiers.find
        .mockReturnValueOnce(criticalQueryResult([]))
        .mockReturnValueOnce(criticalQueryResult([]));

      await expect(service.reconcileOnce()).resolves.toMatchObject({
        claimed: 2,
        processed: 2,
      });

      expect(operations.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: 'operation-retry-compensating',
          status: AuthIdentifierOperationStatus.FailedRetryable,
        }),
        { $set: { status: AuthIdentifierOperationStatus.Compensating } },
      );
      expect(operations.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: 'operation-retry-applying',
          status: AuthIdentifierOperationStatus.FailedRetryable,
        }),
        { $set: { status: AuthIdentifierOperationStatus.Applying } },
      );
    });

    it('skips already-applied and already-compensated assignments during recovery', async () => {
      const applying = operation({
        _id: new Types.ObjectId('507f1f77bcf86cd799439053'),
        operationId: 'operation-skip-applied',
        status: AuthIdentifierOperationStatus.Applying,
        assignments: [
          assignment({
            assignmentId: 'assignment-applied',
            status: AuthIdentifierAssignmentStatus.Applied,
          }),
        ],
      });
      const compensating = operation({
        _id: new Types.ObjectId('507f1f77bcf86cd799439054'),
        operationId: 'operation-skip-compensated',
        status: AuthIdentifierOperationStatus.Compensating,
        assignments: [
          assignment({
            assignmentId: 'assignment-compensated',
            status: AuthIdentifierAssignmentStatus.Compensated,
          }),
        ],
      });
      operations.find.mockReturnValueOnce(
        criticalQueryResult([applying, compensating]),
      );
      operations.findOneAndUpdate
        .mockResolvedValueOnce(applying)
        .mockResolvedValueOnce(compensating);
      identifiers.find
        .mockReturnValueOnce(criticalQueryResult([]))
        .mockReturnValueOnce(criticalQueryResult([]));

      await expect(service.reconcileOnce()).resolves.toMatchObject({
        claimed: 2,
        processed: 2,
      });

      expect(identifiers.findById).not.toHaveBeenCalled();
      expect(identifiers.findOne).not.toHaveBeenCalled();
      expect(identifiers.updateOne).not.toHaveBeenCalled();
      expect(operations.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: 'operation-skip-applied',
          status: AuthIdentifierOperationStatus.Applying,
        }),
        { $set: { status: AuthIdentifierOperationStatus.Finalizing } },
      );
      expect(operations.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: 'operation-skip-compensated',
          status: AuthIdentifierOperationStatus.Compensating,
        }),
        { $set: { status: AuthIdentifierOperationStatus.Finalizing } },
      );
    });

    it('returns missing application and operation-mismatched compensation reservations to retryable', async () => {
      const missingReservationId = new Types.ObjectId(
        '507f1f77bcf86cd799439055',
      );
      const mismatchedReservationId = new Types.ObjectId(
        '507f1f77bcf86cd799439056',
      );
      const applying = operation({
        _id: new Types.ObjectId('507f1f77bcf86cd799439057'),
        operationId: 'operation-missing-reservation',
        status: AuthIdentifierOperationStatus.Applying,
        assignments: [
          assignment({ targetReservationId: missingReservationId }),
        ],
      });
      const compensating = operation({
        _id: new Types.ObjectId('507f1f77bcf86cd799439058'),
        operationId: 'operation-mismatched-reservation',
        status: AuthIdentifierOperationStatus.Compensating,
        assignments: [
          assignment({ targetReservationId: mismatchedReservationId }),
        ],
      });
      operations.find.mockReturnValueOnce(
        criticalQueryResult([applying, compensating]),
      );
      operations.findOneAndUpdate
        .mockResolvedValueOnce(applying)
        .mockResolvedValueOnce(compensating);
      identifiers.find
        .mockReturnValueOnce(criticalQueryResult([]))
        .mockReturnValueOnce(criticalQueryResult([]));
      identifiers.findById.mockResolvedValueOnce(null).mockResolvedValueOnce({
        _id: mismatchedReservationId,
        pendingOperationId: 'another-operation',
      });

      await expect(service.reconcileOnce()).resolves.toMatchObject({
        claimed: 2,
        processed: 2,
      });

      expect(operations.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: 'operation-missing-reservation',
          status: AuthIdentifierOperationStatus.Applying,
        }),
        { $set: { status: AuthIdentifierOperationStatus.FailedRetryable } },
      );
      expect(operations.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: 'operation-mismatched-reservation',
          status: AuthIdentifierOperationStatus.Compensating,
        }),
        { $set: { status: AuthIdentifierOperationStatus.FailedRetryable } },
      );
      expect(identifiers.updateOne).not.toHaveBeenCalled();
      expect(identifiers.findById).toHaveBeenNthCalledWith(
        1,
        missingReservationId,
      );
      expect(identifiers.findById).toHaveBeenNthCalledWith(
        2,
        mismatchedReservationId,
      );
    });

    it.each([
      [AuthIdentifierAssignmentAction.Retain, AuthIdentifierStatus.Conflict],
      [AuthIdentifierAssignmentAction.Release, AuthIdentifierStatus.Active],
      [AuthIdentifierAssignmentAction.Replace, AuthIdentifierStatus.Released],
    ])('restores %s compensation to %s', async (action, restoredStatus) => {
      const reservationId = new Types.ObjectId();
      const candidate = operation({
        operationId: `operation-compensate-${action}`,
        status: AuthIdentifierOperationStatus.Compensating,
        assignments: [
          assignment({ action, targetReservationId: reservationId }),
        ],
      });
      operations.find.mockReturnValueOnce(criticalQueryResult([candidate]));
      operations.findOneAndUpdate.mockResolvedValueOnce(candidate);
      identifiers.find.mockReturnValueOnce(criticalQueryResult([]));
      identifiers.findById.mockResolvedValueOnce({
        _id: reservationId,
        pendingOperationId: candidate.operationId,
      });

      await expect(service.reconcileOnce()).resolves.toMatchObject({
        claimed: 1,
        processed: 1,
      });

      expect(identifiers.updateOne).toHaveBeenCalledWith(
        { _id: reservationId, pendingOperationId: candidate.operationId },
        {
          $set: {
            status: restoredStatus,
            lastOperationId: candidate.operationId,
          },
          $unset: { pendingOperationId: '', pendingAction: '' },
        },
      );
    });

    it('ignores an unmatched discovered reservation without mutating assignments', async () => {
      const candidate = operation({
        status: AuthIdentifierOperationStatus.Pending,
        assignments: [assignment()],
      });
      operations.find.mockReturnValueOnce(criticalQueryResult([candidate]));
      operations.findOneAndUpdate.mockResolvedValueOnce(candidate);
      identifiers.find.mockReturnValueOnce(
        criticalQueryResult([
          {
            _id: new Types.ObjectId(),
            normalizedIdentifier: 'unmatched@example.test',
            pendingOperationId: candidate.operationId,
            pendingAction: AuthIdentifierPendingAction.Replace,
            subjectType: AuthIdentifierSubjectType.Staff,
            subjectId: 'different-subject',
          },
        ]),
      );

      await expect(service.reconcileOnce()).resolves.toMatchObject({
        claimed: 1,
        processed: 1,
      });

      expect(
        operations.updateOne.mock.calls.some(
          ([filter]: [{ 'assignments.assignmentId'?: string }]) =>
            filter['assignments.assignmentId'] === 'assignment-1',
        ),
      ).toBe(false);
    });

    it('attaches an HMAC-only reservation reference under the requested key version', async () => {
      const reservationId = new Types.ObjectId();
      const discoveryCapture: { limit?: number } = {};
      const candidate = operation({
        operationId: 'operation-hmac',
        manifestKeyVersion: 7,
        assignments: [
          assignment({ action: AuthIdentifierAssignmentAction.Replace }),
        ],
      });
      operations.find.mockReturnValueOnce(criticalQueryResult([candidate]));
      operations.findOneAndUpdate.mockResolvedValueOnce(candidate);
      identifiers.find.mockReturnValueOnce(
        criticalQueryResult(
          [
            {
              _id: reservationId,
              normalizedIdentifier: 'secret@example.test',
              pendingOperationId: 'operation-hmac',
              pendingAction: AuthIdentifierPendingAction.Replace,
              subjectType: AuthIdentifierSubjectType.Member,
              subjectId: 'member-1',
            },
          ],
          discoveryCapture,
        ),
      );

      await expect(service.reconcileOnce()).resolves.toMatchObject({
        claimed: 1,
        processed: 1,
      });

      expect(policy.getKeyMaterial).toHaveBeenCalledWith(7);
      expect(identifiers.find).toHaveBeenCalledWith({
        pendingOperationId: 'operation-hmac',
      });
      expect(discoveryCapture.limit).toBe(3);
      expect(operations.updateOne).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          $set: expect.objectContaining({
            'assignments.$.targetReservationId': reservationId,
            'assignments.$.identifierCorrelationHash':
              'bLZ0rnuyCTGVKJOxxRCrP2kL4CD91UgzgPHXkPxGkSw',
            'assignments.$.correlationKeyVersion': 7,
          }),
        }),
      );
      expect(JSON.stringify(operations.updateOne.mock.calls)).not.toContain(
        'secret@example.test',
      );
      expect(
        JSON.stringify(events.recordIdentifierOperationTerminal.mock.calls),
      ).not.toContain('secret@example.test');
    });

    it.each([
      ['missing requested key version', undefined, 'audit-key-material'],
      ['missing requested key material', 7, undefined],
    ])(
      'attaches only the reservation ID with %s',
      async (_case, manifestKeyVersion, keyMaterial) => {
        const reservationId = new Types.ObjectId();
        const candidate = operation({
          operationId: `operation-${manifestKeyVersion ?? 'no-version'}`,
          manifestKeyVersion,
          assignments: [assignment()],
        });
        operations.find.mockReturnValueOnce(criticalQueryResult([candidate]));
        operations.findOneAndUpdate.mockResolvedValueOnce(candidate);
        identifiers.find.mockReturnValueOnce(
          criticalQueryResult([
            {
              _id: reservationId,
              normalizedIdentifier: 'private@example.test',
              pendingOperationId: candidate.operationId,
              pendingAction: AuthIdentifierPendingAction.Claim,
              subjectType: AuthIdentifierSubjectType.Member,
              subjectId: 'member-1',
            },
          ]),
        );
        (policy.getKeyMaterial as jest.Mock).mockReturnValue(keyMaterial);
        if (manifestKeyVersion === undefined) {
          const noVersionConfig = {
            get: jest.fn(),
          } as unknown as ConfigService;
          service = createReconciliationService({ config: noVersionConfig });
        }

        await expect(service.reconcileOnce()).resolves.toMatchObject({
          claimed: 1,
          processed: 1,
        });

        const assignmentWrite = operations.updateOne.mock.calls.find(
          ([filter]: [{ 'assignments.assignmentId'?: string }]) =>
            filter['assignments.assignmentId'] === 'assignment-1',
        );
        expect(assignmentWrite?.[1]).toEqual({
          $set: { 'assignments.$.targetReservationId': reservationId },
        });
        expect(JSON.stringify(assignmentWrite)).not.toContain(
          'identifierCorrelationHash',
        );
        expect(JSON.stringify(assignmentWrite)).not.toContain(
          'correlationKeyVersion',
        );
      },
    );

    it.each([
      {
        name: 'explicit failure result',
        requestedBy: {
          subjectType: AuthIdentifierSubjectType.Member,
          subjectId: 'member-requester',
        },
        assignments: [
          assignment({ status: AuthIdentifierAssignmentStatus.Applied }),
        ],
        result: {
          outcome: AuthIdentifierOperationResultOutcome.Failure,
          reasonCategory: 'identifier-conflict',
          httpStatus: 409,
        },
        terminalStatus: AuthIdentifierOperationStatus.FailedTerminal,
        actorType: 'member',
        outcome: 'failure',
        reasonCategory: 'identifier-conflict',
      },
      {
        name: 'all-compensated fallback',
        requestedBy: {
          subjectType: AuthIdentifierSubjectType.Staff,
          subjectId: 'staff-requester',
        },
        assignments: [
          assignment({ status: AuthIdentifierAssignmentStatus.Compensated }),
        ],
        terminalStatus: AuthIdentifierOperationStatus.FailedTerminal,
        actorType: 'staff',
        outcome: 'failure',
        reasonCategory: 'identifier-operation-compensated',
      },
      {
        name: 'successful system recovery',
        requestedBy: { subjectType: 'system', subjectId: 'system-requester' },
        assignments: [
          assignment({ status: AuthIdentifierAssignmentStatus.Applied }),
        ],
        terminalStatus: AuthIdentifierOperationStatus.Completed,
        actorType: 'staff',
        outcome: 'success',
        reasonCategory: 'identifier-operation-recovered',
      },
    ])(
      'records terminal actor, outcome, and reason for $name',
      async ({
        name,
        requestedBy,
        assignments,
        result,
        terminalStatus,
        actorType,
        outcome,
        reasonCategory,
      }) => {
        const candidate = operation({
          operationId: `operation-${name.replace(/ /g, '-')}`,
          status: AuthIdentifierOperationStatus.Finalizing,
          requestedBy,
          assignments,
          result,
        });
        operations.find.mockReturnValueOnce(criticalQueryResult([candidate]));
        operations.findOneAndUpdate
          .mockResolvedValueOnce(candidate)
          .mockResolvedValueOnce(candidate);
        identifiers.find.mockReturnValueOnce(criticalQueryResult([]));

        await expect(service.reconcileOnce()).resolves.toMatchObject({
          claimed: 1,
          processed: 1,
        });

        expect(events.recordIdentifierOperationTerminal).toHaveBeenCalledWith(
          expect.objectContaining({
            operationId: candidate.operationId,
            terminalStatus,
            actor: { actorType, actorId: requestedBy.subjectId },
            outcome,
            reasonCategory,
          }),
        );
        const terminalWrite = operations.findOneAndUpdate.mock.calls[1][1];
        expect(terminalWrite[0].$set.status).toBe(terminalStatus);
      },
    );

    it('records the terminal event before finalizing cleanup-pending state without a parent TTL', async () => {
      const candidate = operation({
        operationId: 'operation-cleanup-pending-finalize',
        status: AuthIdentifierOperationStatus.Finalizing,
        cleanupStatus: AuthIdentifierOperationCleanupStatus.Pending,
        assignments: [
          assignment({ status: AuthIdentifierAssignmentStatus.Applied }),
        ],
      });
      const ordering: string[] = [];
      operations.find.mockReturnValueOnce(criticalQueryResult([candidate]));
      operations.findOneAndUpdate
        .mockImplementationOnce(async () => candidate)
        .mockImplementationOnce(async () => {
          ordering.push('operation');
          return candidate;
        });
      identifiers.find.mockReturnValueOnce(criticalQueryResult([]));
      events.recordIdentifierOperationTerminal.mockImplementationOnce(
        async () => {
          ordering.push('event');
          return 'event-cleanup-pending';
        },
      );

      await expect(service.reconcileOnce()).resolves.toMatchObject({
        claimed: 1,
        processed: 1,
      });

      expect(ordering).toEqual(['event', 'operation']);
      const terminalSet = operations.findOneAndUpdate.mock.calls[1][1][0].$set;
      expect(terminalSet).toMatchObject({
        status: AuthIdentifierOperationStatus.Completed,
        terminalEventId: 'event-cleanup-pending',
        terminalEventRecordedAt: '$$NOW',
      });
      expect(terminalSet).not.toHaveProperty('expiresAt');
    });

    it('records the terminal event before clean terminal state and retention TTL', async () => {
      const candidate = operation({
        operationId: 'operation-clean-finalize',
        status: AuthIdentifierOperationStatus.Finalizing,
        cleanupStatus: AuthIdentifierOperationCleanupStatus.NotRequired,
        assignments: [
          assignment({ status: AuthIdentifierAssignmentStatus.Applied }),
        ],
      });
      const ordering: string[] = [];
      operations.find.mockReturnValueOnce(criticalQueryResult([candidate]));
      operations.findOneAndUpdate
        .mockResolvedValueOnce(candidate)
        .mockImplementationOnce(async () => {
          ordering.push('operation');
          return candidate;
        });
      identifiers.find.mockReturnValueOnce(criticalQueryResult([]));
      events.recordIdentifierOperationTerminal.mockImplementationOnce(
        async () => {
          ordering.push('event');
          return 'event-clean-finalize';
        },
      );

      await expect(service.reconcileOnce()).resolves.toMatchObject({
        claimed: 1,
        processed: 1,
      });

      expect(ordering).toEqual(['event', 'operation']);
      const terminalSet = operations.findOneAndUpdate.mock.calls[1][1][0].$set;
      expect(terminalSet).toMatchObject({
        status: AuthIdentifierOperationStatus.Completed,
        terminalEventId: 'event-clean-finalize',
        terminalEventRecordedAt: '$$NOW',
        completedAt: '$$NOW',
        expiresAt: {
          $dateAdd: {
            startDate: '$$NOW',
            unit: 'day',
            amount: 91,
          },
        },
      });
    });

    it.each([
      [
        AuthIdentifierOperationStatus.FailedTerminal,
        {
          $set: { status: AuthIdentifierStatus.Released },
          $unset: { activationGateOperationId: '' },
        },
      ],
      [
        AuthIdentifierOperationStatus.Completed,
        { $unset: { activationGateOperationId: '' } },
      ],
    ])(
      'cleans gated identifiers correctly for %s operations',
      async (status, expectedUpdate) => {
        const gate = { _id: new Types.ObjectId() };
        const gateCapture: { limit?: number } = {};
        const batchCapture: { limit?: number } = {};
        const candidate = operation({
          operationId: `operation-cleanup-${status}`,
          status,
          cleanupStatus: AuthIdentifierOperationCleanupStatus.Pending,
          terminalEventId: `event-${status}`,
          terminalEventRecordedAt: new Date('2026-01-01T00:00:00.000Z'),
        });
        operations.find.mockReturnValueOnce(criticalQueryResult([candidate]));
        operations.findOneAndUpdate
          .mockResolvedValueOnce(candidate)
          .mockResolvedValueOnce(candidate)
          .mockResolvedValueOnce(candidate);
        identifiers.find.mockReturnValueOnce(
          criticalQueryResult([gate], gateCapture),
        );
        batches.find.mockReturnValueOnce(criticalQueryResult([], batchCapture));

        await expect(service.reconcileOnce()).resolves.toMatchObject({
          claimed: 1,
          processed: 1,
        });

        expect(identifiers.updateMany).toHaveBeenCalledWith(
          { _id: { $in: [gate._id] } },
          expectedUpdate,
        );
        expect(gateCapture.limit).toBe(2);
        expect(batchCapture.limit).toBe(1);
        expect(identifiers.find).toHaveBeenCalledWith({
          activationGateOperationId: candidate.operationId,
        });
        expect(batches.find).toHaveBeenCalledWith({
          parentOperationId: candidate.operationId,
          expiresAt: { $exists: false },
        });
        expect(identifiers.exists).toHaveBeenCalledWith({
          activationGateOperationId: candidate.operationId,
        });
        expect(batches.exists).toHaveBeenCalledWith({
          parentOperationId: candidate.operationId,
          expiresAt: { $exists: false },
        });
      },
    );

    it('defers batch expiry when gated identifiers exhaust cleanup capacity', async () => {
      const gates = [
        { _id: new Types.ObjectId() },
        { _id: new Types.ObjectId() },
      ];
      const gateCapture: { limit?: number } = {};
      const candidate = operation({
        operationId: 'operation-gates-exhaust-capacity',
        status: AuthIdentifierOperationStatus.Completed,
        cleanupStatus: AuthIdentifierOperationCleanupStatus.Pending,
        terminalEventId: 'event-gates-exhaust-capacity',
        terminalEventRecordedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      operations.find.mockReturnValueOnce(criticalQueryResult([candidate]));
      operations.findOneAndUpdate
        .mockResolvedValueOnce(candidate)
        .mockResolvedValueOnce(candidate);
      identifiers.find.mockReturnValueOnce(
        criticalQueryResult(gates, gateCapture),
      );
      identifiers.exists.mockResolvedValueOnce(gates[0]);

      await expect(service.reconcileOnce()).resolves.toMatchObject({
        claimed: 1,
        processed: 1,
      });

      expect(batches.find).not.toHaveBeenCalled();
      expect(batches.updateMany).not.toHaveBeenCalled();
      expect(gateCapture.limit).toBe(2);
      expect(identifiers.find).toHaveBeenCalledWith({
        activationGateOperationId: candidate.operationId,
      });
      expect(identifiers.exists).toHaveBeenCalledWith({
        activationGateOperationId: candidate.operationId,
      });
      expect(batches.exists).toHaveBeenCalledWith({
        parentOperationId: candidate.operationId,
        expiresAt: { $exists: false },
      });
      expect(operations.findOneAndUpdate).toHaveBeenCalledTimes(2);
    });

    it('keeps cleanup pending while gate or batch work remains', async () => {
      const gate = { _id: new Types.ObjectId() };
      const batch = { _id: new Types.ObjectId() };
      const candidate = operation({
        operationId: 'operation-cleanup-remains',
        status: AuthIdentifierOperationStatus.Completed,
        cleanupStatus: AuthIdentifierOperationCleanupStatus.Pending,
        terminalEventId: 'event-cleanup-remains',
        terminalEventRecordedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      operations.find.mockReturnValueOnce(criticalQueryResult([candidate]));
      operations.findOneAndUpdate
        .mockResolvedValueOnce(candidate)
        .mockResolvedValueOnce(candidate);
      identifiers.find.mockReturnValueOnce(criticalQueryResult([gate]));
      batches.find.mockReturnValueOnce(criticalQueryResult([batch]));
      batches.exists.mockResolvedValueOnce(batch);

      await expect(service.reconcileOnce()).resolves.toMatchObject({
        claimed: 1,
        processed: 1,
      });

      expect(batches.updateMany).toHaveBeenCalledWith(
        { _id: { $in: [batch._id] } },
        [{ $set: { expiresAt: '$$NOW' } }],
        { updatePipeline: true },
      );
      expect(identifiers.find).toHaveBeenCalledWith({
        activationGateOperationId: candidate.operationId,
      });
      expect(batches.find).toHaveBeenCalledWith({
        parentOperationId: candidate.operationId,
        expiresAt: { $exists: false },
      });
      expect(identifiers.exists).toHaveBeenCalledWith({
        activationGateOperationId: candidate.operationId,
      });
      expect(batches.exists).toHaveBeenCalledWith({
        parentOperationId: candidate.operationId,
        expiresAt: { $exists: false },
      });
      expect(operations.findOneAndUpdate).toHaveBeenCalledTimes(2);
    });

    it('completes empty cleanup remainder and applies retention only after terminal event fields exist', async () => {
      const candidate = operation({
        operationId: 'operation-cleanup-complete',
        status: AuthIdentifierOperationStatus.Completed,
        cleanupStatus: AuthIdentifierOperationCleanupStatus.Pending,
        terminalEventId: 'event-cleanup-complete',
        terminalEventRecordedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      operations.find.mockReturnValueOnce(criticalQueryResult([candidate]));
      operations.findOneAndUpdate
        .mockResolvedValueOnce(candidate)
        .mockResolvedValueOnce(candidate)
        .mockResolvedValueOnce(candidate);
      identifiers.find.mockReturnValueOnce(criticalQueryResult([]));
      batches.find.mockReturnValueOnce(criticalQueryResult([]));

      await expect(service.reconcileOnce()).resolves.toMatchObject({
        claimed: 1,
        processed: 1,
      });

      expect(operations.findOneAndUpdate.mock.calls[2][0]).toMatchObject({
        operationId: candidate.operationId,
        cleanupStatus: AuthIdentifierOperationCleanupStatus.Pending,
        terminalEventId: { $exists: true },
        terminalEventRecordedAt: { $exists: true },
      });
      expect(
        operations.findOneAndUpdate.mock.calls[2][1][0].$set,
      ).toMatchObject({
        cleanupStatus: AuthIdentifierOperationCleanupStatus.Completed,
        expiresAt: {
          $dateAdd: {
            startDate: '$$NOW',
            unit: 'day',
            amount: 91,
          },
        },
      });
      expect(identifiers.find).toHaveBeenCalledWith({
        activationGateOperationId: candidate.operationId,
      });
      expect(batches.find).toHaveBeenCalledWith({
        parentOperationId: candidate.operationId,
        expiresAt: { $exists: false },
      });
      expect(identifiers.exists).toHaveBeenCalledWith({
        activationGateOperationId: candidate.operationId,
      });
      expect(batches.exists).toHaveBeenCalledWith({
        parentOperationId: candidate.operationId,
        expiresAt: { $exists: false },
      });
    });

    it('releases every claimed lease when one public operation recovery fails', async () => {
      const failing = operation({
        _id: new Types.ObjectId('507f1f77bcf86cd799439059'),
        operationId: 'operation-public-failure',
        assignments: [assignment()],
      });
      const following = operation({
        _id: new Types.ObjectId('507f1f77bcf86cd799439060'),
        operationId: 'operation-public-following',
      });
      operations.find.mockReturnValueOnce(
        criticalQueryResult([failing, following]),
      );
      operations.findOneAndUpdate
        .mockResolvedValueOnce(failing)
        .mockResolvedValueOnce(following);
      identifiers.find
        .mockReturnValueOnce(
          criticalQueryResult([
            {
              _id: new Types.ObjectId(),
              normalizedIdentifier: 'failing@example.test',
              pendingOperationId: failing.operationId,
              pendingAction: AuthIdentifierPendingAction.Claim,
              subjectType: AuthIdentifierSubjectType.Member,
              subjectId: 'member-1',
            },
          ]),
        )
        .mockReturnValueOnce(criticalQueryResult([]));
      (policy.getKeyMaterial as jest.Mock)
        .mockImplementationOnce(() => {
          throw new Error('transient key provider failure');
        })
        .mockReturnValueOnce('audit-key-material');

      await expect(service.reconcileOnce()).resolves.toMatchObject({
        claimed: 2,
        processed: 1,
      });

      const leaseReleases = operations.updateOne.mock.calls.filter(
        ([, update]: unknown[]) => Array.isArray(update),
      );
      expect(
        leaseReleases.map(
          ([filter]: [{ operationId: string }]) => filter.operationId,
        ),
      ).toEqual(['operation-public-failure', 'operation-public-following']);
    });
  });
});
