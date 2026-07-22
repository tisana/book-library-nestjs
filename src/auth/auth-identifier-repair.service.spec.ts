import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthIdentifierRepairService } from './auth-identifier-repair.service';
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
    };
    const repairBatchModel = {
      find: jest.fn(() => ({
        sort: jest.fn(() => ({ exec: jest.fn().mockResolvedValue([]) })),
      })),
    };
    const identifierModel = { updateOne: jest.fn() };
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
});
