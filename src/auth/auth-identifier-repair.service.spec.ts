import {
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createIdentifierOperation,
  criticalQueryResult,
} from '../../test/support/critical-auth-fixtures';
import {
  createStaffDocument,
  createStaffModelHarness,
  queryResult,
} from '../../test/support/backend-coverage-fixtures';
import { AuthIdentifierRepairService } from './auth-identifier-repair.service';
import {
  AuthIdentifierRepairManifest,
  hashRepairManifest,
} from './auth-identifier-repair-manifest';
import {
  AuthIdentifierOperationStatus,
  AuthIdentifierOperationType,
} from './schemas/auth-identifier-operation.schema';
import {
  AuthIdentifierStatus,
  AuthIdentifierSubjectType,
} from './schemas/auth-identifier.schema';
import { AuthIdentifierRepairBatchStatus } from './schemas/auth-identifier-repair-batch.schema';

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
    const adminActor = createStaffDocument({ id: 'admin-2' });
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
      findById: jest.fn(),
      updateOne: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      findOneAndUpdate: jest.fn(),
    };
    const staffHarness = createStaffModelHarness();
    const staffUserModel = Object.assign(staffHarness.model, {
      findById: jest.fn(() => aggregateQueryResult(staffHarness.document)),
    });
    const memberModel = {
      findById: jest.fn(() =>
        aggregateQueryResult({
          loginIdentifier: 'current-member@example.test',
          authVersion: 0,
        }),
      ),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const authorization = {
      authorizeDryRun: jest.fn().mockResolvedValue({
        subjectType: AuthIdentifierSubjectType.Staff,
        subjectId: adminActor.id,
        authVersion: adminActor.authVersion,
        expiresAt: 1_800_000_000,
      }),
      authorizeMutation: jest.fn().mockResolvedValue({
        subjectType: AuthIdentifierSubjectType.Staff,
        subjectId: adminActor.id,
        authVersion: adminActor.authVersion,
        expiresAt: 1_800_000_000,
      }),
    };
    const keyPolicy = {
      repairWorkerDecision: jest.fn().mockReturnValue({ allowed: true }),
      getKeyMaterial: jest.fn().mockReturnValue(Buffer.alloc(32, 4)),
    };
    const securityActivity = {
      recordIdentifierRepairResumed: jest.fn(),
      recordIdentifierOperationTerminal: jest.fn().mockResolvedValue('event-1'),
    };
    const configGet = jest.fn((key: string) =>
      key === 'auth.identifierMaxOperationAssignments' ? 2 : 1,
    );
    const config = { get: configGet } as unknown as ConfigService;
    const service = new AuthIdentifierRepairService(
      operationModel as never,
      repairBatchModel as never,
      identifierModel as never,
      staffUserModel as never,
      memberModel as never,
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
      staffUserModel,
      memberModel,
      configGet,
      authorization,
      keyPolicy,
      securityActivity,
    };
  }

  function expectNoModelMutations(fixture: ReturnType<typeof createFixture>) {
    expect(fixture.operationModel.create).not.toHaveBeenCalled();
    expect(fixture.operationModel.updateOne).not.toHaveBeenCalled();
    expect(fixture.repairBatchModel.create).not.toHaveBeenCalled();
    expect(fixture.repairBatchModel.updateOne).not.toHaveBeenCalled();
    expect(fixture.identifierModel.updateOne).not.toHaveBeenCalled();
    expect(fixture.identifierModel.updateMany).not.toHaveBeenCalled();
    expect(fixture.identifierModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(fixture.staffUserModel.updateOne).not.toHaveBeenCalled();
    expect(fixture.memberModel.updateOne).not.toHaveBeenCalled();
  }

  function conflictReservation(status = AuthIdentifierStatus.Conflict) {
    return {
      _id: manifest.conflictId,
      status,
      conflictingSubjects: [manifest.retainedSubject, ...manifest.reassignments],
    };
  }

  function aggregateQueryResult<T>(value: T) {
    const query = queryResult(value) as ReturnType<typeof queryResult> & {
      lean: jest.Mock;
    };
    query.lean = jest.fn(() => query);
    return query;
  }

  function repairOperation(
    operationId: string,
    repairManifest: AuthIdentifierRepairManifest,
    status = AuthIdentifierOperationStatus.Applying,
  ) {
    return createIdentifierOperation({
      operationId,
      operationType: AuthIdentifierOperationType.OfflineRepair,
      status,
      manifestHash: hashRepairManifest(repairManifest, Buffer.alloc(32, 4), 1)
        .manifestHash,
      manifestKeyVersion: 1,
    });
  }

  function conflictFor(repairManifest: AuthIdentifierRepairManifest) {
    return {
      _id: repairManifest.conflictId,
      normalizedIdentifier: 'shared@example.test',
      status: AuthIdentifierStatus.Conflict,
      conflictingSubjects: [
        ...(repairManifest.retainedSubject
          ? [repairManifest.retainedSubject]
          : []),
        ...repairManifest.reassignments,
      ],
    };
  }

  function transactionSession(order?: string[]) {
    return {
      withTransaction: jest.fn(async (work: () => Promise<void>) => work()),
      endSession: jest.fn().mockImplementation(async () => {
        order?.push('end-session');
      }),
    };
  }

  const oneMemberManifest: AuthIdentifierRepairManifest = {
    conflictId: 'conflict-transaction',
    retainedSubject: {
      subjectType: AuthIdentifierSubjectType.Staff,
      subjectId: 'staff-retained',
    },
    reassignments: [
      {
        subjectType: AuthIdentifierSubjectType.Member,
        subjectId: 'member-reassigned',
        newIdentifier: 'member-reassigned@example.test',
      },
    ],
  };

  it.each([undefined, '', '   '])(
    'rejects unstable resume id %p before authorization or mutation',
    async (resumeId) => {
      const fixture = createFixture();
      try {
        await fixture.service.apply({
          token: 'redacted-admin-token',
          operationId: 'repair-1',
          manifest,
          resumeId,
        });
        fail('Expected apply to reject an unstable resume id');
      } catch (error) {
        expect(error).toBeInstanceOf(UnprocessableEntityException);
        expect(error).toMatchObject({
          message: 'A stable resume id is required',
        });
        expect((error as UnprocessableEntityException).getStatus()).toBe(422);
      }
      expect(fixture.authorization.authorizeMutation).not.toHaveBeenCalled();
      expectNoModelMutations(fixture);
    },
  );

  it('rejects a missing current key version before operation lookup or creation', async () => {
    const fixture = createFixture();
    fixture.configGet.mockImplementation((key: string) =>
      key === 'auth.identifierMaxOperationAssignments' ? 2 : undefined,
    );
    fixture.identifierModel.findById.mockResolvedValue(conflictReservation());

    await expect(
      fixture.service.dryRun({
        token: 'redacted-admin-token',
        operationId: 'repair-key-missing',
        manifest,
      }),
    ).rejects.toMatchObject({ message: 'repair-key-required' });

    expect(fixture.operationModel.findOne).not.toHaveBeenCalled();
    expectNoModelMutations(fixture);
  });

  it.each([
    [
      'operation type',
      createIdentifierOperation({
        operationId: 'repair-existing-type',
        operationType: AuthIdentifierOperationType.Claim,
        manifestKeyVersion: 1,
        manifestHash: hashRepairManifest(manifest, Buffer.alloc(32, 4), 1)
          .manifestHash,
      }),
    ],
    [
      'manifest key version',
      createIdentifierOperation({
        operationId: 'repair-existing-version',
        operationType: AuthIdentifierOperationType.OfflineRepair,
        manifestKeyVersion: 2,
        manifestHash: hashRepairManifest(manifest, Buffer.alloc(32, 4), 1)
          .manifestHash,
      }),
    ],
    [
      'manifest hash',
      createIdentifierOperation({
        operationId: 'repair-existing-hash',
        operationType: AuthIdentifierOperationType.OfflineRepair,
        manifestKeyVersion: 1,
        manifestHash: 'mismatched-manifest-hash',
      }),
    ],
  ])(
    'rejects an existing operation with a wrong %s without mutation',
    async (_case, operation) => {
      const fixture = createFixture();
      fixture.identifierModel.findById.mockResolvedValue(conflictReservation());
      fixture.operationModel.findOne.mockReturnValue(criticalQueryResult(operation));

      await expect(
        fixture.service.dryRun({
          token: 'redacted-admin-token',
          operationId: operation.operationId,
          manifest,
        }),
      ).rejects.toMatchObject({
        message: 'Repair operation id is already in use',
      });

      expectNoModelMutations(fixture);
    },
  );

  it.each([
    ['missing conflict', null],
    ['non-conflict reservation', conflictReservation(AuthIdentifierStatus.Active)],
  ])('returns the same public error for a %s', async (_case, reservation) => {
    const fixture = createFixture();
    fixture.identifierModel.findById.mockResolvedValue(reservation);

    await expect(
      fixture.service.dryRun({
        token: 'redacted-admin-token',
        operationId: 'repair-conflict-missing',
        manifest,
      }),
    ).rejects.toMatchObject({ message: 'Identifier conflict not found' });

    expect(fixture.operationModel.findOne).not.toHaveBeenCalled();
    expectNoModelMutations(fixture);
  });

  it.each([
    [
      'an omitted claimant',
      { ...manifest, reassignments: manifest.reassignments.slice(0, 2) },
    ],
    [
      'a foreign claimant',
      {
        ...manifest,
        reassignments: [
          ...manifest.reassignments.slice(0, 2),
          { ...manifest.reassignments[2], subjectId: 'member-foreign' },
        ],
      },
    ],
    [
      'a duplicate claimant',
      {
        ...manifest,
        reassignments: [
          ...manifest.reassignments.slice(0, 2),
          {
            ...manifest.reassignments[2],
            subjectId: manifest.reassignments[1].subjectId,
          },
        ],
      },
    ],
  ])(
    'rejects a manifest with %s before operation mutation',
    async (_case, invalidManifest) => {
      const fixture = createFixture();
      fixture.identifierModel.findById.mockResolvedValue(conflictReservation());

      await expect(
        fixture.service.dryRun({
          token: 'redacted-admin-token',
          operationId: 'repair-invalid-manifest',
          manifest: invalidManifest,
        }),
      ).rejects.toMatchObject({
        message: 'Repair manifest must account for every conflict claimant',
      });

      expect(fixture.operationModel.findOne).not.toHaveBeenCalled();
      expectNoModelMutations(fixture);
    },
  );

  it.each([
    ['apply', 'stable-resume-missing'],
    ['cancel', undefined],
  ] as const)(
    'returns the same public error when %s cannot find its operation',
    async (method, resumeId) => {
      const fixture = createFixture();
      fixture.operationModel.findOne.mockResolvedValue(null);

      await expect(
        fixture.service[method]({
          token: 'redacted-admin-token',
          operationId: 'repair-operation-missing',
          manifest,
          resumeId,
        }),
      ).rejects.toMatchObject({ message: 'Repair operation not found' });

      expectNoModelMutations(fixture);
    },
  );

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
    fixture.operationModel.findOne.mockReturnValue(
      criticalQueryResult(
        createIdentifierOperation({
          operationId: 'repair-dry-run',
          operationType: AuthIdentifierOperationType.OfflineRepair,
          status: AuthIdentifierOperationStatus.Pending,
          manifestKeyVersion: 1,
          manifestHash: manifestHash.manifestHash,
        }),
      ),
    );
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
    expect(fixture.staffUserModel.updateOne).not.toHaveBeenCalled();
    expect(fixture.memberModel.updateOne).not.toHaveBeenCalled();
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

  it('revalidates authorization after the final compensation batch before parent mutations', async () => {
    const fixture = createFixture();
    const operation = {
      operationId: 'repair-5',
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
      sort: jest.fn(() => ({ exec: jest.fn().mockResolvedValue([{ batchNumber: 0 }]) })),
    });
    jest
      .spyOn(fixture.service as never, 'compensateBatch' as never)
      .mockResolvedValue(undefined as never);
    const finish = jest
      .spyOn(fixture.service as never, 'finishFailedParent' as never)
      .mockResolvedValue(undefined as never);

    await expect(
      fixture.service.cancel({
        token: 'expired-token',
        operationId: 'repair-5',
        manifest,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(fixture.identifierModel.updateOne).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
    expect(fixture.operationModel.updateOne).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: AuthIdentifierOperationStatus.Compensating }),
      { $set: { status: AuthIdentifierOperationStatus.FailedRetryable } },
    );
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

  it('rejects a mismatched pending batch checkpoint before aggregate mutation and ends the session', async () => {
    const fixture = createFixture();
    const operation = repairOperation('repair-checkpoint', oneMemberManifest);
    const session = transactionSession();
    fixture.operationModel.findOne.mockResolvedValue(operation);
    fixture.identifierModel.findById.mockResolvedValue(
      conflictFor(oneMemberManifest),
    );
    fixture.repairBatchModel.findOne.mockResolvedValue({
      status: AuthIdentifierRepairBatchStatus.Pending,
      checkpointHash: 'different-checkpoint',
    });
    fixture.operationModel.db.startSession.mockResolvedValue(session);

    await expect(
      fixture.service.apply({
        token: 'redacted-admin-token',
        operationId: operation.operationId,
        manifest: oneMemberManifest,
        resumeId: 'resume-checkpoint',
      }),
    ).rejects.toMatchObject({
      message: 'Repair batch checkpoint does not match',
    });

    expect(session.endSession).toHaveBeenCalledTimes(1);
    expect(fixture.identifierModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(fixture.staffUserModel.updateOne).not.toHaveBeenCalled();
    expect(fixture.memberModel.updateOne).not.toHaveBeenCalled();
  });

  it('rejects activation when a public apply observes a batch that is no longer prepared', async () => {
    const fixture = createFixture();
    const operation = repairOperation('repair-activation-state', oneMemberManifest);
    fixture.operationModel.findOne.mockResolvedValue(operation);
    fixture.identifierModel.findById.mockResolvedValue(
      conflictFor(oneMemberManifest),
    );
    fixture.repairBatchModel.findOne
      .mockResolvedValueOnce({ status: AuthIdentifierRepairBatchStatus.Prepared })
      .mockResolvedValueOnce({
        status: AuthIdentifierRepairBatchStatus.Pending,
        assignments: [],
      });

    await expect(
      fixture.service.apply({
        token: 'redacted-admin-token',
        operationId: operation.operationId,
        manifest: oneMemberManifest,
        resumeId: 'resume-activation-state',
      }),
    ).rejects.toMatchObject({ message: 'Repair batch is not prepared' });

    expect(fixture.operationModel.db.startSession).not.toHaveBeenCalled();
    expect(fixture.identifierModel.updateMany).not.toHaveBeenCalled();
  });

  it('fails before repair writes when MongoDB transaction support is absent', async () => {
    const fixture = createFixture();
    const operation = repairOperation('repair-transaction-check', oneMemberManifest);
    const endSession = jest.fn().mockResolvedValue(undefined);
    fixture.operationModel.findOne.mockResolvedValue(operation);
    fixture.identifierModel.findById.mockResolvedValue(
      conflictFor(oneMemberManifest),
    );
    fixture.repairBatchModel.findOne.mockResolvedValue(null);
    fixture.operationModel.db.startSession.mockResolvedValue({ endSession });

    await expect(
      fixture.service.apply({
        token: 'redacted-admin-token',
        operationId: operation.operationId,
        manifest: oneMemberManifest,
        resumeId: 'resume-transaction-check',
      }),
    ).rejects.toMatchObject({
      message: 'Offline repair requires transaction support',
    });

    expect(endSession).toHaveBeenCalledTimes(1);
    expect(fixture.repairBatchModel.create).not.toHaveBeenCalled();
    expect(fixture.identifierModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(fixture.identifierModel.updateOne).not.toHaveBeenCalled();
  });

  it('maps a null replacement upsert to the fixed unavailable error and ends the session', async () => {
    const fixture = createFixture();
    const operation = repairOperation('repair-null-upsert', oneMemberManifest);
    const session = transactionSession();
    fixture.operationModel.findOne.mockResolvedValue(operation);
    fixture.identifierModel.findById.mockResolvedValue(
      conflictFor(oneMemberManifest),
    );
    fixture.repairBatchModel.findOne.mockResolvedValue(null);
    fixture.repairBatchModel.create.mockResolvedValue([{ _id: 'batch-null' }]);
    fixture.identifierModel.findOneAndUpdate.mockResolvedValue(null);
    fixture.operationModel.db.startSession.mockResolvedValue(session);

    await expect(
      fixture.service.apply({
        token: 'redacted-admin-token',
        operationId: operation.operationId,
        manifest: oneMemberManifest,
        resumeId: 'resume-null-upsert',
      }),
    ).rejects.toMatchObject({ message: 'Replacement unavailable' });

    expect(session.endSession).toHaveBeenCalledTimes(1);
    expect(fixture.memberModel.updateOne).not.toHaveBeenCalled();
  });

  it('maps duplicate replacement writes to the fixed reservation conflict', async () => {
    const fixture = createFixture();
    const operation = repairOperation('repair-duplicate-upsert', oneMemberManifest);
    const session = transactionSession();
    fixture.operationModel.findOne.mockResolvedValue(operation);
    fixture.identifierModel.findById.mockResolvedValue(
      conflictFor(oneMemberManifest),
    );
    fixture.repairBatchModel.findOne.mockResolvedValue(null);
    fixture.repairBatchModel.create.mockResolvedValue([{ _id: 'batch-duplicate' }]);
    fixture.identifierModel.findOneAndUpdate.mockRejectedValue({ code: 11000 });
    fixture.operationModel.db.startSession.mockResolvedValue(session);

    await expect(
      fixture.service.apply({
        token: 'redacted-admin-token',
        operationId: operation.operationId,
        manifest: oneMemberManifest,
        resumeId: 'resume-duplicate-upsert',
      }),
    ).rejects.toMatchObject({
      message: 'Replacement identifier is already reserved',
    });

    expect(session.endSession).toHaveBeenCalledTimes(1);
    expect(fixture.memberModel.updateOne).not.toHaveBeenCalled();
  });

  it('rethrows a nonduplicate replacement write failure unchanged', async () => {
    const fixture = createFixture();
    const operation = repairOperation('repair-storage-failure', oneMemberManifest);
    const session = transactionSession();
    const storageFailure = new Error('replacement-write-failed');
    fixture.operationModel.findOne.mockResolvedValue(operation);
    fixture.identifierModel.findById.mockResolvedValue(
      conflictFor(oneMemberManifest),
    );
    fixture.repairBatchModel.findOne.mockResolvedValue(null);
    fixture.repairBatchModel.create.mockResolvedValue([{ _id: 'batch-storage' }]);
    fixture.identifierModel.findOneAndUpdate.mockRejectedValue(storageFailure);
    fixture.operationModel.db.startSession.mockResolvedValue(session);

    await expect(
      fixture.service.apply({
        token: 'redacted-admin-token',
        operationId: operation.operationId,
        manifest: oneMemberManifest,
        resumeId: 'resume-storage-failure',
      }),
    ).rejects.toBe(storageFailure);

    expect(session.endSession).toHaveBeenCalledTimes(1);
    expect(fixture.memberModel.updateOne).not.toHaveBeenCalled();
  });

  it.each([
    ['staff', AuthIdentifierSubjectType.Staff, 'staff-missing', 'staffUserModel'],
    ['member', AuthIdentifierSubjectType.Member, 'member-missing', 'memberModel'],
  ] as const)(
    'maps a missing %s aggregate to the fixed subject-not-found error',
    async (_label, subjectType, subjectId, modelName) => {
      const fixture = createFixture();
      const missingManifest: AuthIdentifierRepairManifest = {
        conflictId: `conflict-${subjectId}`,
        retainedSubject: {
          subjectType: AuthIdentifierSubjectType.Member,
          subjectId: 'member-retained',
        },
        reassignments: [
          {
            subjectType,
            subjectId,
            newIdentifier: `${subjectId}@example.test`,
          },
        ],
      };
      const operation = repairOperation(
        `repair-missing-${subjectId}`,
        missingManifest,
      );
      const session = transactionSession();
      const aggregateModel = fixture[modelName] as {
        findById: jest.Mock;
        updateOne: jest.Mock;
      };
      aggregateModel.findById.mockReturnValue(aggregateQueryResult(null));
      fixture.operationModel.findOne.mockResolvedValue(operation);
      fixture.identifierModel.findById.mockResolvedValue(
        conflictFor(missingManifest),
      );
      fixture.repairBatchModel.findOne.mockResolvedValue(null);
      fixture.repairBatchModel.create.mockResolvedValue([
        { _id: `batch-${subjectId}` },
      ]);
      fixture.identifierModel.findOneAndUpdate.mockResolvedValue({
        _id: `reservation-${subjectId}`,
      });
      fixture.operationModel.db.startSession.mockResolvedValue(session);

      await expect(
        fixture.service.apply({
          token: 'redacted-admin-token',
          operationId: operation.operationId,
          manifest: missingManifest,
          resumeId: `resume-missing-${subjectId}`,
        }),
      ).rejects.toMatchObject({ message: 'Repair subject not found' });

      expect(session.endSession).toHaveBeenCalledTimes(1);
      expect(aggregateModel.updateOne).not.toHaveBeenCalled();
    },
  );

  it('skips the aggregate update when the replacement identifier is already assigned', async () => {
    const fixture = createFixture();
    const operation = repairOperation('repair-already-assigned', oneMemberManifest);
    const completed = {
      ...operation,
      status: AuthIdentifierOperationStatus.Completed,
    };
    const session = transactionSession();
    const memberModel = fixture.memberModel as typeof fixture.memberModel & {
      findById: jest.Mock;
    };
    memberModel.findById.mockReturnValue(
      aggregateQueryResult({
        loginIdentifier: oneMemberManifest.reassignments[0].newIdentifier,
      }),
    );
    fixture.operationModel.findOne
      .mockResolvedValueOnce(operation)
      .mockResolvedValueOnce(completed);
    fixture.identifierModel.findById.mockResolvedValue(
      conflictFor(oneMemberManifest),
    );
    fixture.repairBatchModel.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        status: AuthIdentifierRepairBatchStatus.Prepared,
        assignments: [{ targetReservationId: 'reservation-existing' }],
      });
    fixture.repairBatchModel.create.mockResolvedValue([{ _id: 'batch-existing' }]);
    fixture.identifierModel.findOneAndUpdate.mockResolvedValue({
      _id: 'reservation-existing',
    });
    fixture.operationModel.db.startSession.mockResolvedValue(session);

    await fixture.service.apply({
      token: 'redacted-admin-token',
      operationId: operation.operationId,
      manifest: oneMemberManifest,
      resumeId: 'resume-already-assigned',
    });

    expect(memberModel.updateOne).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledTimes(3);
  });

  it('updates staff email and member loginIdentifier while incrementing authVersion once', async () => {
    const fixture = createFixture();
    const aggregateManifest: AuthIdentifierRepairManifest = {
      conflictId: 'conflict-aggregate-fields',
      retainedSubject: {
        subjectType: AuthIdentifierSubjectType.Staff,
        subjectId: 'staff-retained',
      },
      reassignments: [
        {
          subjectType: AuthIdentifierSubjectType.Staff,
          subjectId: 'staff-reassigned',
          newIdentifier: 'staff-reassigned@example.test',
        },
        {
          subjectType: AuthIdentifierSubjectType.Member,
          subjectId: 'member-reassigned',
          newIdentifier: 'member-reassigned@example.test',
        },
      ],
    };
    const operation = repairOperation(
      'repair-aggregate-fields',
      aggregateManifest,
    );
    const session = transactionSession();
    const staffModel = fixture.staffUserModel as typeof fixture.staffUserModel & {
      findById: jest.Mock;
    };
    const memberModel = fixture.memberModel as typeof fixture.memberModel & {
      findById: jest.Mock;
    };
    staffModel.findById.mockReturnValue(
      aggregateQueryResult({ email: 'current-staff@example.test' }),
    );
    memberModel.findById.mockReturnValue(
      aggregateQueryResult({ loginIdentifier: 'current-member@example.test' }),
    );
    fixture.operationModel.findOne
      .mockResolvedValueOnce(operation)
      .mockResolvedValueOnce({
        ...operation,
        status: AuthIdentifierOperationStatus.Completed,
      });
    fixture.identifierModel.findById.mockResolvedValue(
      conflictFor(aggregateManifest),
    );
    fixture.repairBatchModel.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        status: AuthIdentifierRepairBatchStatus.Prepared,
        assignments: [
          { targetReservationId: 'reservation-staff' },
          { targetReservationId: 'reservation-member' },
        ],
      });
    fixture.repairBatchModel.create.mockResolvedValue([{ _id: 'batch-fields' }]);
    fixture.identifierModel.findOneAndUpdate
      .mockResolvedValueOnce({ _id: 'reservation-staff' })
      .mockResolvedValueOnce({ _id: 'reservation-member' });
    fixture.operationModel.db.startSession.mockResolvedValue(session);

    await fixture.service.apply({
      token: 'redacted-admin-token',
      operationId: operation.operationId,
      manifest: aggregateManifest,
      resumeId: 'resume-aggregate-fields',
    });

    expect(staffModel.findById).toHaveBeenCalledWith('staff-reassigned');
    expect(staffModel.updateOne).toHaveBeenCalledTimes(1);
    expect(staffModel.updateOne).toHaveBeenCalledWith(
      { _id: 'staff-reassigned' },
      { $set: { email: expect.any(String) }, $inc: { authVersion: 1 } },
      { session },
    );
    expect(memberModel.findById).toHaveBeenCalledWith('member-reassigned');
    expect(memberModel.updateOne).toHaveBeenCalledTimes(1);
    expect(memberModel.updateOne).toHaveBeenCalledWith(
      { _id: 'member-reassigned' },
      {
        $set: { loginIdentifier: expect.any(String) },
        $inc: { authVersion: 1 },
      },
      { session },
    );
    expect(session.endSession).toHaveBeenCalledTimes(3);
  });

  it('releases the original conflict under the first reassigned subject and records the terminal event first', async () => {
    const fixture = createFixture();
    const noRetainedManifest: AuthIdentifierRepairManifest = {
      conflictId: 'conflict-no-retained',
      reassignments: [
        {
          subjectType: AuthIdentifierSubjectType.Member,
          subjectId: 'member-first',
          newIdentifier: 'member-first@example.test',
        },
      ],
    };
    const operation = repairOperation('repair-no-retained', noRetainedManifest);
    const session = transactionSession();
    const terminalOrder: string[] = [];
    const memberModel = fixture.memberModel as typeof fixture.memberModel & {
      findById: jest.Mock;
    };
    memberModel.findById.mockReturnValue(
      aggregateQueryResult({ loginIdentifier: 'current-member@example.test' }),
    );
    fixture.operationModel.findOne
      .mockResolvedValueOnce(operation)
      .mockResolvedValueOnce({
        ...operation,
        status: AuthIdentifierOperationStatus.Completed,
      });
    fixture.operationModel.updateOne.mockImplementation(
      async (_filter: unknown, update: { $set?: { status?: string } }) => {
        if (update.$set?.status === AuthIdentifierOperationStatus.Completed) {
          terminalOrder.push('operation');
        }
        return { modifiedCount: 1 };
      },
    );
    fixture.identifierModel.findById.mockResolvedValue(
      conflictFor(noRetainedManifest),
    );
    fixture.identifierModel.updateOne.mockResolvedValue({ modifiedCount: 1 });
    fixture.repairBatchModel.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        status: AuthIdentifierRepairBatchStatus.Prepared,
        assignments: [{ targetReservationId: 'reservation-first' }],
      });
    fixture.repairBatchModel.create.mockResolvedValue([{ _id: 'batch-first' }]);
    fixture.identifierModel.findOneAndUpdate.mockResolvedValue({
      _id: 'reservation-first',
    });
    fixture.securityActivity.recordIdentifierOperationTerminal.mockImplementation(
      async () => {
        terminalOrder.push('event');
        return 'event-completed';
      },
    );
    fixture.operationModel.db.startSession.mockResolvedValue(session);

    await fixture.service.apply({
      token: 'redacted-admin-token',
      operationId: operation.operationId,
      manifest: noRetainedManifest,
      resumeId: 'resume-no-retained',
    });

    expect(fixture.identifierModel.updateOne).toHaveBeenCalledWith(
      {
        _id: noRetainedManifest.conflictId,
        status: AuthIdentifierStatus.Conflict,
      },
      {
        $set: {
          status: AuthIdentifierStatus.Released,
          subjectType: AuthIdentifierSubjectType.Member,
          subjectId: 'member-first',
          releasedAt: expect.any(Date),
          lastOperationId: operation.operationId,
        },
        $unset: {
          conflictingSubjects: '',
          conflictResolutionStatus: '',
          pendingOperationId: '',
          pendingAction: '',
        },
      },
      { session },
    );
    expect(terminalOrder).toEqual(['event', 'operation']);
    expect(
      fixture.securityActivity.recordIdentifierOperationTerminal,
    ).toHaveBeenCalledWith(
      {
        operationId: operation.operationId,
        operationType: AuthIdentifierOperationType.OfflineRepair,
        terminalStatus: 'completed',
        actor: { actorType: 'staff', actorId: 'admin-2' },
        outcome: 'success',
        reasonCategory: 'identifier-offline-repair-completed',
      },
      session,
    );
    expect(session.endSession).toHaveBeenCalledTimes(3);
  });

  it('skips non-releasable cancellation assignments and still records a redacted failed terminal event first', async () => {
    const fixture = createFixture();
    const operation = repairOperation(
      'repair-cancel-skips',
      oneMemberManifest,
      AuthIdentifierOperationStatus.FailedRetryable,
    );
    const session = transactionSession();
    const terminalOrder: string[] = [];
    fixture.operationModel.findOne
      .mockResolvedValueOnce(operation)
      .mockResolvedValueOnce({
        ...operation,
        status: AuthIdentifierOperationStatus.FailedTerminal,
      });
    fixture.operationModel.updateOne.mockImplementation(
      async (_filter: unknown, update: { $set?: { status?: string } }) => {
        if (update.$set?.status === AuthIdentifierOperationStatus.FailedTerminal) {
          terminalOrder.push('operation');
        }
        return { modifiedCount: 1 };
      },
    );
    fixture.identifierModel.findById.mockResolvedValue(
      conflictFor(oneMemberManifest),
    );
    fixture.identifierModel.updateOne.mockResolvedValue({ modifiedCount: 1 });
    fixture.repairBatchModel.find.mockReturnValue({
      sort: jest.fn(() => ({
        exec: jest.fn().mockResolvedValue([
          {
            _id: 'batch-cancel-skips',
            status: AuthIdentifierRepairBatchStatus.Prepared,
            assignments: [
              {
                subjectType: AuthIdentifierSubjectType.Member,
                subjectId: 'member-unmapped',
                targetReservationId: 'reservation-unmapped',
              },
              {
                subjectType: AuthIdentifierSubjectType.Member,
                subjectId: 'member-reassigned',
              },
            ],
          },
        ]),
      })),
    });
    fixture.securityActivity.recordIdentifierOperationTerminal.mockImplementation(
      async () => {
        terminalOrder.push('event');
        return 'event-failed';
      },
    );
    fixture.operationModel.db.startSession.mockResolvedValue(session);

    const result = await fixture.service.cancel({
      token: 'redacted-admin-token',
      operationId: operation.operationId,
      manifest: oneMemberManifest,
    });

    expect(fixture.memberModel.updateOne).toHaveBeenCalledTimes(1);
    expect(fixture.memberModel.updateOne).toHaveBeenCalledWith(
      { _id: 'member-reassigned' },
      {
        $set: { loginIdentifier: expect.any(String) },
        $inc: { authVersion: 1 },
      },
      { session },
    );
    expect(fixture.staffUserModel.updateOne).not.toHaveBeenCalled();
    expect(fixture.identifierModel.updateOne).not.toHaveBeenCalledWith(
      { _id: 'reservation-unmapped' },
      expect.anything(),
      expect.anything(),
    );
    expect(terminalOrder).toEqual(['event', 'operation']);
    expect(
      fixture.securityActivity.recordIdentifierOperationTerminal,
    ).toHaveBeenCalledWith(
      {
        operationId: operation.operationId,
        operationType: AuthIdentifierOperationType.OfflineRepair,
        terminalStatus: 'failed-terminal',
        actor: { actorType: 'staff', actorId: 'admin-2' },
        outcome: 'failure',
        reasonCategory: 'identifier-offline-repair-cancelled',
      },
      session,
    );
    expect(session.endSession).toHaveBeenCalledTimes(2);
    expect(result.status).toBe(AuthIdentifierOperationStatus.FailedTerminal);
  });
});
