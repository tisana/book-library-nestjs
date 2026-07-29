import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthIdentifierRepairService } from './auth-identifier-repair.service';
import { hashRepairManifest } from './auth-identifier-repair-manifest';
import {
  AuthIdentifierOperationStatus,
  AuthIdentifierOperationType,
} from './schemas/auth-identifier-operation.schema';
import {
  AuthIdentifierStatus,
  AuthIdentifierSubjectType,
} from './schemas/auth-identifier.schema';

describe('AuthIdentifierRepairService', () => {
  const manifest = {
    conflictId: 'conflict-1',
    retainedSubject: {
      subjectType: AuthIdentifierSubjectType.Staff,
      subjectId: 'staff-1',
    },
    reassignments: [
      {
        subjectType: AuthIdentifierSubjectType.Member,
        subjectId: 'member-1',
        newIdentifier: 'member-1@example.test',
      },
      {
        subjectType: AuthIdentifierSubjectType.Member,
        subjectId: 'member-2',
        newIdentifier: 'member-2@example.test',
      },
      {
        subjectType: AuthIdentifierSubjectType.Member,
        subjectId: 'member-3',
        newIdentifier: 'member-3@example.test',
      },
    ],
  };

  function createFixture() {
    const operationModel = {
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      findOne: jest.fn(),
      create: jest.fn(),
      db: {
        startSession: jest.fn(),
      },
    };
    const repairBatchModel = {
      find: jest.fn(() => ({
        sort: jest.fn(() => ({ exec: jest.fn().mockResolvedValue([]) })),
      })),
      findOne: jest.fn(),
      create: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const identifierModel = {
      updateOne: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      findOneAndUpdate: jest.fn(),
    };
    const authorization = {
      authorizeDryRun: jest.fn().mockResolvedValue({ subjectId: 'admin-1' }),
      authorizeMutation: jest.fn().mockResolvedValue({ subjectId: 'admin-2' }),
    };
    const keyPolicy = {
      repairWorkerDecision: jest.fn().mockReturnValue({ allowed: true }),
      getKeyMaterial: jest.fn().mockReturnValue(Buffer.alloc(32, 4)),
    };
    const securityActivity = {
      recordIdentifierRepairResumed: jest.fn(),
      recordIdentifierOperationTerminal: jest.fn().mockResolvedValue('event-1'),
    };
    const config = {
      get: jest.fn((key: string) =>
        key === 'auth.identifierMaxOperationAssignments' ? 2 : 1,
      ),
    } as unknown as ConfigService;
    const service = new AuthIdentifierRepairService(
      operationModel as never,
      repairBatchModel as never,
      identifierModel as never,
      {} as never,
      {} as never,
      authorization as never,
      keyPolicy as never,
      securityActivity as never,
      config,
    );
    const internals = service as unknown as Record<string, jest.Mock>;
    return {
      service,
      internals,
      operationModel,
      repairBatchModel,
      identifierModel,
      authorization,
      keyPolicy,
      securityActivity,
    };
  }

  it('uses bounded unique batches, reauthorizes each mutation boundary, and completes atomically', async () => {
    const fixture = createFixture();
    const operation = {
      operationId: 'repair-1',
      operationType: AuthIdentifierOperationType.OfflineRepair,
      status: AuthIdentifierOperationStatus.Pending,
      manifestHash: 'persisted-hash',
      manifestKeyVersion: 1,
      requestedBy: { subjectId: 'admin-1' },
    };
    jest
      .spyOn(fixture.service as never, 'requireOperation' as never)
      .mockResolvedValueOnce(operation as never)
      .mockResolvedValueOnce({
        ...operation,
        status: AuthIdentifierOperationStatus.Completed,
        result: { reasonCategory: 'identifier-offline-repair-completed' },
      } as never);
    jest
      .spyOn(fixture.service as never, 'verifyPersistedManifest' as never)
      .mockReturnValue(undefined as never);
    jest
      .spyOn(fixture.service as never, 'loadConflict' as never)
      .mockResolvedValue({
        _id: 'conflict-1',
        status: AuthIdentifierStatus.Conflict,
        conflictingSubjects: [manifest.retainedSubject, ...manifest.reassignments],
      } as never);
    jest
      .spyOn(fixture.service as never, 'validateManifestSubjects' as never)
      .mockReturnValue(undefined as never);
    const prepareBatch = jest
      .spyOn(fixture.service as never, 'prepareBatch' as never)
      .mockResolvedValue(undefined as never);
    const activateBatch = jest
      .spyOn(fixture.service as never, 'activateBatch' as never)
      .mockResolvedValue(undefined as never);
    const completeParent = jest
      .spyOn(fixture.service as never, 'completeParent' as never)
      .mockResolvedValue(undefined as never);

    const result = await fixture.service.apply({
      token: 'stdin-token',
      operationId: 'repair-1',
      resumeId: 'stable-resume-1',
      manifest,
    });

    expect(fixture.authorization.authorizeMutation).toHaveBeenCalledTimes(6);
    expect(prepareBatch).toHaveBeenCalledTimes(2);
    expect(prepareBatch.mock.calls[0][2]).toHaveLength(2);
    expect(prepareBatch.mock.calls[1][2]).toHaveLength(1);
    expect(activateBatch).toHaveBeenNthCalledWith(1, 'repair-1', 0);
    expect(activateBatch).toHaveBeenNthCalledWith(2, 'repair-1', 1);
    expect(completeParent).toHaveBeenCalledTimes(1);
    expect(fixture.operationModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ status: AuthIdentifierOperationStatus.Applying }),
      { $set: { status: AuthIdentifierOperationStatus.Finalizing } },
    );
    expect(fixture.securityActivity.recordIdentifierRepairResumed).toHaveBeenCalledWith(
      expect.objectContaining({
        originalActor: expect.objectContaining({ actorId: 'admin-1' }),
        resumingActor: expect.objectContaining({ actorId: 'admin-2' }),
      }),
    );
    expect(result).toMatchObject({
      status: AuthIdentifierOperationStatus.Completed,
      batchCount: 2,
    });
  });

  it('fails closed before parent completion when authorization expires', async () => {
    const fixture = createFixture();
    fixture.authorization.authorizeMutation
      .mockResolvedValueOnce({ subjectId: 'admin-1' })
      .mockResolvedValueOnce({ subjectId: 'admin-1' })
      .mockResolvedValueOnce({ subjectId: 'admin-1' })
      .mockResolvedValueOnce({ subjectId: 'admin-1' })
      .mockResolvedValueOnce({ subjectId: 'admin-1' })
      .mockRejectedValueOnce(new UnauthorizedException('authorization-denied'));
    const operation = {
      operationId: 'repair-2',
      operationType: AuthIdentifierOperationType.OfflineRepair,
      status: AuthIdentifierOperationStatus.Applying,
      manifestHash: 'persisted-hash',
      manifestKeyVersion: 1,
      requestedBy: { subjectId: 'admin-1' },
    };
    jest
      .spyOn(fixture.service as never, 'requireOperation' as never)
      .mockResolvedValue(operation as never);
    jest
      .spyOn(fixture.service as never, 'verifyPersistedManifest' as never)
      .mockReturnValue(undefined as never);
    jest
      .spyOn(fixture.service as never, 'loadConflict' as never)
      .mockResolvedValue({ status: AuthIdentifierStatus.Conflict } as never);
    jest
      .spyOn(fixture.service as never, 'validateManifestSubjects' as never)
      .mockReturnValue(undefined as never);
    jest
      .spyOn(fixture.service as never, 'prepareBatch' as never)
      .mockResolvedValue(undefined as never);
    jest
      .spyOn(fixture.service as never, 'activateBatch' as never)
      .mockResolvedValue(undefined as never);
    const completeParent = jest
      .spyOn(fixture.service as never, 'completeParent' as never)
      .mockResolvedValue(undefined as never);

    await expect(
      fixture.service.apply({
        token: 'expired-token',
        operationId: 'repair-2',
        resumeId: 'stable-resume-2',
        manifest,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(completeParent).not.toHaveBeenCalled();
    expect(fixture.operationModel.updateOne).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: AuthIdentifierOperationStatus.Applying }),
      { $set: { status: AuthIdentifierOperationStatus.FailedRetryable } },
    );
  });

  it('reverse-compensates batches before terminal cancellation', async () => {
    const fixture = createFixture();
    const operation = {
      operationId: 'repair-3',
      operationType: AuthIdentifierOperationType.OfflineRepair,
      status: AuthIdentifierOperationStatus.FailedRetryable,
      manifestHash: 'persisted-hash',
      manifestKeyVersion: 1,
      requestedBy: { subjectId: 'admin-1' },
    };
    jest
      .spyOn(fixture.service as never, 'requireOperation' as never)
      .mockResolvedValueOnce(operation as never)
      .mockResolvedValueOnce({
        ...operation,
        status: AuthIdentifierOperationStatus.FailedTerminal,
      } as never);
    jest
      .spyOn(fixture.service as never, 'verifyPersistedManifest' as never)
      .mockReturnValue(undefined as never);
    const batches = [{ batchNumber: 1 }, { batchNumber: 0 }];
    fixture.repairBatchModel.find.mockReturnValue({
      sort: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(batches) })),
    });
    const compensate = jest
      .spyOn(fixture.service as never, 'compensateBatch' as never)
      .mockResolvedValue(undefined as never);
    jest
      .spyOn(fixture.service as never, 'finishFailedParent' as never)
      .mockResolvedValue(undefined as never);

    await fixture.service.cancel({
      token: 'stdin-token',
      operationId: 'repair-3',
      manifest,
    });

    expect(compensate.mock.calls.map((call) => call[0])).toEqual(batches);
    expect(fixture.identifierModel.updateOne).toHaveBeenCalledWith(
      { _id: 'conflict-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: AuthIdentifierStatus.Conflict,
          conflictResolutionStatus: 'manual-repair-required',
        }),
      }),
    );
  });

  it('dry-runs an existing matching operation without mutating any model', async () => {
    const fixture = createFixture();
    const manifestHash = hashRepairManifest(manifest, Buffer.alloc(32, 4), 1);
    fixture.operationModel.findOne.mockReturnValue({
      lean: () => ({
        exec: jest.fn().mockResolvedValue({
          operationId: 'repair-dry-run',
          operationType: AuthIdentifierOperationType.OfflineRepair,
          status: AuthIdentifierOperationStatus.Pending,
          manifestKeyVersion: 1,
          manifestHash: manifestHash.manifestHash,
        }),
      }),
    });
    jest
      .spyOn(fixture.service as never, 'loadConflict' as never)
      .mockResolvedValue({
        status: AuthIdentifierStatus.Conflict,
        conflictingSubjects: [manifest.retainedSubject, ...manifest.reassignments],
      } as never);

    await expect(
      fixture.service.dryRun({
        token: 'stdin-token',
        operationId: 'repair-dry-run',
        manifest,
      }),
    ).resolves.toMatchObject({
      status: AuthIdentifierOperationStatus.Pending,
      replayed: true,
      batchCount: 2,
    });

    expect(fixture.operationModel.create).not.toHaveBeenCalled();
    expect(fixture.operationModel.updateOne).not.toHaveBeenCalled();
    expect(fixture.repairBatchModel.find).not.toHaveBeenCalled();
    expect(fixture.identifierModel.updateOne).not.toHaveBeenCalled();
  });

  it('rejects an unavailable manifest key before looking up an operation', async () => {
    const fixture = createFixture();
    fixture.keyPolicy.repairWorkerDecision.mockReturnValue({ allowed: false });
    jest
      .spyOn(fixture.service as never, 'loadConflict' as never)
      .mockResolvedValue({
        status: AuthIdentifierStatus.Conflict,
        conflictingSubjects: [manifest.retainedSubject, ...manifest.reassignments],
      } as never);

    await expect(
      fixture.service.dryRun({
        token: 'stdin-token',
        operationId: 'repair-key-denied',
        manifest,
      }),
    ).rejects.toThrow('repair-key-required');

    expect(fixture.operationModel.findOne).not.toHaveBeenCalled();
    expect(fixture.operationModel.create).not.toHaveBeenCalled();
  });

  it('replays a completed operation without preparing or activating batches', async () => {
    const fixture = createFixture();
    const completed = {
      operationId: 'repair-completed',
      operationType: AuthIdentifierOperationType.OfflineRepair,
      status: AuthIdentifierOperationStatus.Completed,
      manifestHash: 'persisted-hash',
      manifestKeyVersion: 1,
      result: { reasonCategory: 'identifier-offline-repair-completed' },
    };
    jest
      .spyOn(fixture.service as never, 'requireOperation' as never)
      .mockResolvedValue(completed as never);
    jest
      .spyOn(fixture.service as never, 'verifyPersistedManifest' as never)
      .mockReturnValue(undefined as never);
    const prepare = jest.spyOn(fixture.service as never, 'prepareBatch' as never);
    const activate = jest.spyOn(fixture.service as never, 'activateBatch' as never);

    await expect(
      fixture.service.apply({
        token: 'stdin-token',
        operationId: 'repair-completed',
        resumeId: 'resume-completed',
        manifest,
      }),
    ).resolves.toMatchObject({
      status: AuthIdentifierOperationStatus.Completed,
      replayed: true,
      reasonCategory: 'identifier-offline-repair-completed',
    });

    expect(prepare).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
    expect(fixture.operationModel.updateOne).not.toHaveBeenCalled();
  });

  it('fails closed when a resume manifest differs from the persisted hash', async () => {
    const fixture = createFixture();
    jest
      .spyOn(fixture.service as never, 'requireOperation' as never)
      .mockResolvedValue({
        operationId: 'repair-mismatch',
        operationType: AuthIdentifierOperationType.OfflineRepair,
        status: AuthIdentifierOperationStatus.Pending,
        manifestHash: 'different-hash',
        manifestKeyVersion: 1,
      } as never);

    await expect(
      fixture.service.apply({
        token: 'stdin-token',
        operationId: 'repair-mismatch',
        resumeId: 'resume-mismatch',
        manifest,
      }),
    ).rejects.toThrow('Repair manifest does not match dry run');

    expect(fixture.operationModel.updateOne).not.toHaveBeenCalled();
    expect(fixture.repairBatchModel.find).not.toHaveBeenCalled();
  });

  it('replays terminal cancellation without compensation mutations', async () => {
    const fixture = createFixture();
    jest
      .spyOn(fixture.service as never, 'requireOperation' as never)
      .mockResolvedValue({
        operationId: 'repair-cancelled',
        operationType: AuthIdentifierOperationType.OfflineRepair,
        status: AuthIdentifierOperationStatus.FailedTerminal,
        manifestHash: 'persisted-hash',
        manifestKeyVersion: 1,
        result: { reasonCategory: 'identifier-offline-repair-cancelled' },
      } as never);
    jest
      .spyOn(fixture.service as never, 'verifyPersistedManifest' as never)
      .mockReturnValue(undefined as never);

    await expect(
      fixture.service.cancel({
        token: 'stdin-token',
        operationId: 'repair-cancelled',
        manifest,
      }),
    ).resolves.toMatchObject({
      status: AuthIdentifierOperationStatus.FailedTerminal,
      replayed: true,
      reasonCategory: 'identifier-offline-repair-cancelled',
    });

    expect(fixture.repairBatchModel.find).not.toHaveBeenCalled();
    expect(fixture.identifierModel.updateOne).not.toHaveBeenCalled();
    expect(fixture.operationModel.updateOne).not.toHaveBeenCalled();
  });

  it('leaves cancellation retryable when authorization expires between compensation batches', async () => {
    const fixture = createFixture();
    const operation = {
      operationId: 'repair-4',
      operationType: AuthIdentifierOperationType.OfflineRepair,
      status: AuthIdentifierOperationStatus.Applying,
      manifestHash: 'persisted-hash',
      manifestKeyVersion: 1,
      requestedBy: { subjectId: 'admin-1' },
    };
    fixture.authorization.authorizeMutation
      .mockResolvedValueOnce({ subjectId: 'admin-1' })
      .mockResolvedValueOnce({ subjectId: 'admin-1' })
      .mockRejectedValueOnce(new UnauthorizedException('authorization-denied'));
    jest
      .spyOn(fixture.service as never, 'requireOperation' as never)
      .mockResolvedValue(operation as never);
    jest
      .spyOn(fixture.service as never, 'verifyPersistedManifest' as never)
      .mockReturnValue(undefined as never);
    fixture.repairBatchModel.find.mockReturnValue({
      sort: jest.fn(() => ({
        exec: jest.fn().mockResolvedValue([{ batchNumber: 1 }, { batchNumber: 0 }]),
      })),
    });
    const compensate = jest
      .spyOn(fixture.service as never, 'compensateBatch' as never)
      .mockResolvedValue(undefined as never);

    await expect(
      fixture.service.cancel({
        token: 'expired-token',
        operationId: 'repair-4',
        manifest,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(compensate).toHaveBeenCalledTimes(1);
    expect(fixture.operationModel.updateOne).toHaveBeenLastCalledWith(
      expect.objectContaining({
        operationId: 'repair-4',
        status: AuthIdentifierOperationStatus.Compensating,
      }),
      { $set: { status: AuthIdentifierOperationStatus.FailedRetryable } },
    );
    expect(fixture.identifierModel.updateOne).not.toHaveBeenCalled();
  });

  it('prepares a new bounded batch before applying its aggregate changes', async () => {
    const fixture = createFixture();
    const session = {
      withTransaction: async (work: () => Promise<void>) => work(),
      endSession: jest.fn(),
    };
    fixture.operationModel.db.startSession.mockResolvedValue(session);
    fixture.repairBatchModel.findOne.mockResolvedValue(null);
    fixture.repairBatchModel.create.mockResolvedValue([{ _id: 'batch-1' }]);
    const reserve = jest
      .spyOn(fixture.service as never, 'reserveReplacement' as never)
      .mockResolvedValue({ _id: 'reservation-1' } as never);
    const apply = jest
      .spyOn(fixture.service as never, 'applyAggregateIdentifier' as never)
      .mockResolvedValue(undefined as never);

    await (fixture.service as any).prepareBatch(
      {
        operationId: 'repair-prepare',
        manifestKeyVersion: 1,
        requestedBy: { subjectId: 'admin-1' },
      },
      { _id: 'conflict-1' },
      manifest.reassignments.slice(0, 1),
      0,
      2,
    );

    expect(fixture.repairBatchModel.create).toHaveBeenCalledWith(
      [expect.objectContaining({ batchNumber: 0, batchCount: 2 })],
      { session },
    );
    expect(reserve).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(fixture.repairBatchModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ batchNumber: 0 }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'prepared' }),
      }),
      { session },
    );
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it('activates a prepared batch and keeps its identifiers gated until parent completion', async () => {
    const fixture = createFixture();
    const session = {
      withTransaction: async (work: () => Promise<void>) => work(),
      endSession: jest.fn(),
    };
    fixture.operationModel.db.startSession.mockResolvedValue(session);
    fixture.repairBatchModel.findOne.mockResolvedValue({
      status: 'prepared',
      assignments: [{ targetReservationId: 'reservation-1' }],
    });
    await (fixture.service as any).activateBatch('repair-activate', 0);

    expect(fixture.identifierModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ pendingOperationId: 'repair-activate' }),
      expect.objectContaining({
        $set: expect.objectContaining({ activationGateOperationId: 'repair-activate' }),
      }),
      { session },
    );
    expect(fixture.repairBatchModel.updateOne).toHaveBeenCalledWith(
      { parentOperationId: 'repair-activate', batchNumber: 0 },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'activated' }),
      }),
      { session },
    );
  });

  it('compensates batch assignments in reverse and releases their reservations', async () => {
    const fixture = createFixture();
    const session = {
      withTransaction: async (work: () => Promise<void>) => work(),
      endSession: jest.fn(),
    };
    fixture.operationModel.db.startSession.mockResolvedValue(session);
    jest
      .spyOn(fixture.service as never, 'loadConflict' as never)
      .mockResolvedValue({ normalizedIdentifier: 'shared@example.test' } as never);
    const restore = jest
      .spyOn(fixture.service as never, 'setAggregateIdentifier' as never)
      .mockResolvedValue(undefined as never);

    await (fixture.service as any).compensateBatch(
      {
        _id: 'batch-1',
        status: 'prepared',
        assignments: [
          {
            subjectType: AuthIdentifierSubjectType.Member,
            subjectId: 'member-1',
            targetReservationId: 'reservation-1',
          },
        ],
      },
      manifest,
    );

    expect(restore).toHaveBeenCalledWith(
      AuthIdentifierSubjectType.Member,
      'member-1',
      'shared@example.test',
      session,
    );
    expect(fixture.identifierModel.updateOne).toHaveBeenCalledWith(
      { _id: 'reservation-1' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'released' }) }),
      { session },
    );
    expect(fixture.repairBatchModel.updateOne).toHaveBeenCalledWith(
      { _id: 'batch-1' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'compensated' }) }),
      { session },
    );
  });

  it('treats already prepared batch work as idempotent without opening a transaction', async () => {
    const fixture = createFixture();
    fixture.repairBatchModel.findOne.mockResolvedValue({ status: 'activated' });

    await (fixture.service as any).prepareBatch(
      { operationId: 'repair-idempotent', manifestKeyVersion: 1 },
      { _id: 'conflict-1' },
      manifest.reassignments.slice(0, 1),
      0,
      1,
    );

    expect(fixture.operationModel.db.startSession).not.toHaveBeenCalled();
    expect(fixture.repairBatchModel.create).not.toHaveBeenCalled();
  });

  it('does not activate missing or already activated batches', async () => {
    const fixture = createFixture();
    fixture.repairBatchModel.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ status: 'activated' });

    await (fixture.service as any).activateBatch('repair-noop', 0);
    await (fixture.service as any).activateBatch('repair-noop', 1);

    expect(fixture.operationModel.db.startSession).not.toHaveBeenCalled();
    expect(fixture.identifierModel.updateMany).not.toHaveBeenCalled();
  });

  it('does not compensate an already compensated batch', async () => {
    const fixture = createFixture();

    await (fixture.service as any).compensateBatch(
      { status: 'compensated', assignments: [] },
      manifest,
    );

    expect(fixture.operationModel.db.startSession).not.toHaveBeenCalled();
    expect(fixture.identifierModel.updateOne).not.toHaveBeenCalled();
  });

  it('completes the parent only after recording its terminal event', async () => {
    const fixture = createFixture();
    const calls: string[] = [];
    const session = {
      withTransaction: async (work: () => Promise<void>) => work(),
      endSession: jest.fn(),
    };
    fixture.operationModel.db.startSession.mockResolvedValue(session);
    fixture.identifierModel.updateOne.mockImplementation(async () => {
      calls.push('identifier');
    });
    fixture.securityActivity.recordIdentifierOperationTerminal.mockImplementation(async () => {
      calls.push('event');
      return 'event-1';
    });
    fixture.operationModel.updateOne.mockImplementation(async () => {
      calls.push('operation');
    });

    await (fixture.service as any).completeParent(
      { operationId: 'repair-parent' },
      manifest,
      'admin-1',
    );

    expect(calls).toEqual(['identifier', 'event', 'operation']);
    expect(fixture.operationModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ status: AuthIdentifierOperationStatus.Finalizing }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: AuthIdentifierOperationStatus.Completed }),
      }),
      { session },
    );
  });

  it('records a cancellation terminal event before failing its parent', async () => {
    const fixture = createFixture();
    const session = {
      withTransaction: async (work: () => Promise<void>) => work(),
      endSession: jest.fn(),
    };
    fixture.operationModel.db.startSession.mockResolvedValue(session);

    await (fixture.service as any).finishFailedParent('repair-failed', 'admin-1');

    expect(fixture.securityActivity.recordIdentifierOperationTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'repair-failed',
        terminalStatus: 'failed-terminal',
      }),
      session,
    );
    expect(fixture.operationModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ status: AuthIdentifierOperationStatus.Finalizing }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: AuthIdentifierOperationStatus.FailedTerminal }),
      }),
      { session },
    );
  });

  it('reserves a replacement with pending ownership for the repair operation', async () => {
    const fixture = createFixture();
    const session = {};
    fixture.identifierModel.findOneAndUpdate.mockResolvedValue({ _id: 'reservation-1' });

    await expect(
      (fixture.service as any).reserveReplacement(
        {
          operationId: 'repair-reserve',
          requestedBy: { subjectId: 'admin-1' },
        },
        manifest.reassignments[0],
        session,
      ),
    ).resolves.toMatchObject({ _id: 'reservation-1' });

    expect(fixture.identifierModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ normalizedIdentifier: 'member-1@example.test' }),
      expect.objectContaining({
        $set: expect.objectContaining({ pendingOperationId: 'repair-reserve' }),
      }),
      expect.objectContaining({ upsert: true, session }),
    );
  });

  it('maps duplicate replacement reservations to a conflict without leaking database errors', async () => {
    const fixture = createFixture();
    fixture.identifierModel.findOneAndUpdate.mockRejectedValue({ code: 11000 });

    await expect(
      (fixture.service as any).reserveReplacement(
        { operationId: 'repair-duplicate', requestedBy: { subjectId: 'admin-1' } },
        manifest.reassignments[0],
        {},
      ),
    ).rejects.toThrow('Replacement identifier is already reserved');
  });
});
