import { UnprocessableEntityException } from '@nestjs/common';
import {
  AuthIdentifierAggregateAdapter,
  AuthIdentifierAssignmentInput,
  AuthIdentifierOperationInput,
  AuthIdentifierService,
} from './auth-identifier.service';

const query = <T>(value: T) => ({
  lean: () => query(value),
  exec: async () => value,
});

class MemoryPersistence {
  readonly operations = new Map<string, any>();
  readonly identifiers = new Map<string, any>();
  readonly order: string[] = [];
  transactionError?: Error;

  readonly operationModel: any = {
    db: {
      startSession: async () => {
        if (this.transactionError) {
          throw this.transactionError;
        }
        return {
          withTransaction: async (work: () => Promise<void>) => work(),
          endSession: jest.fn().mockResolvedValue(undefined),
        };
      },
    },
    create: async (documents: any[]) => {
      const operation = structuredClone(documents[0]);
      if (this.operations.has(operation.operationId)) {
        throw Object.assign(new Error('duplicate'), { code: 11000 });
      }
      this.operations.set(operation.operationId, operation);
      return [operation];
    },
    findOne: (filter: any) =>
      query(this.operations.get(filter.operationId) ?? null),
    findOneAndUpdate: (filter: any, update: any) => {
      const operation = this.operations.get(filter.operationId);
      if (!operation || (filter.status && operation.status !== filter.status)) {
        return query(null);
      }
      this.applyOperationUpdate(operation, filter, update);
      if (
        update.$set?.status === 'completed' ||
        update.$set?.status === 'failed-terminal'
      ) {
        this.order.push('terminal-state');
      }
      return query(operation);
    },
    updateOne: (filter: any, update: any) => {
      const operation = this.operations.get(filter.operationId);
      if (operation) {
        this.applyOperationUpdate(operation, filter, update);
      }
      return query({ acknowledged: true });
    },
  };

  readonly identifierModel: any = {
    create: jest.fn(),
    findOne: (filter: any) => {
      const reservation = [...this.identifiers.values()].find(
        (item) =>
          (filter._id && String(item._id) === String(filter._id)) ||
          (filter.normalizedIdentifier &&
            item.normalizedIdentifier === filter.normalizedIdentifier) ||
          (filter.pendingOperationId &&
            item.pendingOperationId === filter.pendingOperationId &&
            item.subjectType === filter.subjectType &&
            item.subjectId === filter.subjectId &&
            item.pendingAction === filter.pendingAction),
      );
      return query(reservation ?? null);
    },
    findOneAndUpdate: (filter: any, update: any, options: any) => {
      let reservation = [...this.identifiers.values()].find(
        (item) =>
          (filter._id && String(item._id) === String(filter._id)) ||
          (filter.normalizedIdentifier &&
            item.normalizedIdentifier === filter.normalizedIdentifier),
      );
      if (!reservation && options?.upsert) {
        reservation = {
          _id: `reservation-${this.identifiers.size + 1}`,
          ...update.$setOnInsert,
        };
        this.identifiers.set(String(reservation._id), reservation);
      }
      if (reservation) {
        Object.assign(reservation, update.$set ?? {});
      }
      return query(reservation ?? null);
    },
    updateOne: (filter: any, update: any) => {
      const reservation = this.identifiers.get(String(filter._id));
      if (reservation) {
        Object.assign(reservation, update.$set ?? {});
        for (const key of Object.keys(update.$unset ?? {})) {
          delete reservation[key];
        }
      }
      return query({ acknowledged: true });
    },
  };

  private applyOperationUpdate(operation: any, filter: any, update: any) {
    for (const [key, value] of Object.entries(update.$set ?? {})) {
      if (key.startsWith('assignments.$.')) {
        const assignment = operation.assignments.find(
          (item: any) =>
            item.assignmentId === filter['assignments.assignmentId'],
        );
        if (assignment) {
          assignment[key.slice('assignments.$.'.length)] = value;
        }
      } else {
        operation[key] = value;
      }
    }
  }
}

const assignment = (index = 1): AuthIdentifierAssignmentInput => ({
  assignmentId: `assignment-${index}`,
  subjectType: 'member',
  subjectId: `member-${index}`,
  action: 'claim',
  normalizedIdentifier: `reader-${index}@example.test`,
  identifierType: 'email',
  identifierCorrelationHash: `hash-${index}`,
  correlationKeyVersion: 1,
});

const operationInput = (
  overrides: Partial<AuthIdentifierOperationInput> = {},
): AuthIdentifierOperationInput => ({
  operationId: 'operation-1',
  operationType: 'claim',
  assignments: [assignment()],
  requestedBy: {
    subjectType: 'staff',
    subjectId: 'staff-1',
  },
  successHttpStatus: 201,
  ...overrides,
});

const aggregate = (): jest.Mocked<AuthIdentifierAggregateAdapter> => ({
  apply: jest.fn().mockResolvedValue(undefined),
  compensate: jest.fn().mockResolvedValue(undefined),
  isApplied: jest.fn().mockResolvedValue(false),
});

const buildService = (
  persistence = new MemoryPersistence(),
  options: Record<string, unknown> = { transactionStrategy: 'disabled' },
) => {
  const security = {
    recordIdentifierOperationTerminal: jest
      .fn()
      .mockImplementation(async (input: any) => {
        persistence.order.push('terminal-event');
        return `event:${input.operationId}:${input.terminalStatus}`;
      }),
    recordIdentifierRepairResumed: jest.fn().mockResolvedValue('resume-event'),
  };
  return {
    persistence,
    security,
    service: new AuthIdentifierService(
      persistence.identifierModel,
      persistence.operationModel,
      security as any,
      options,
    ),
  };
};

describe('AuthIdentifierService', () => {
  it.each([19, 20])(
    'accepts an operation with %i assignments',
    async (count) => {
      const { service } = buildService();
      const result = await service.execute(
        operationInput({
          assignments: Array.from({ length: count }, (_, index) =>
            assignment(index + 1),
          ),
        }),
        aggregate(),
      );

      expect(result.status).toBe('completed');
    },
  );

  it('rejects an operation with 21 assignments using 422 semantics', async () => {
    const { service } = buildService();

    await expect(
      service.execute(
        operationInput({
          assignments: Array.from({ length: 21 }, (_, index) =>
            assignment(index + 1),
          ),
        }),
        aggregate(),
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('allows documented transitions and rejects terminal replay transitions', () => {
    const { service } = buildService();

    expect(() =>
      service.validateTransition('pending', 'applying'),
    ).not.toThrow();
    expect(() =>
      service.validateTransition('failed-retryable', 'applying'),
    ).not.toThrow();
    expect(() => service.validateTransition('completed', 'applying')).toThrow(
      'Invalid identifier operation transition',
    );
  });

  it('uses a transaction when available', async () => {
    const persistence = new MemoryPersistence();
    const startSession = jest.spyOn(
      persistence.operationModel.db,
      'startSession',
    );
    const { service } = buildService(persistence, {
      transactionStrategy: 'required',
    });

    await service.execute(operationInput(), aggregate());

    expect(startSession).toHaveBeenCalledTimes(1);
  });

  it('falls back to the durable saga only when transactions are unavailable', async () => {
    const persistence = new MemoryPersistence();
    persistence.transactionError = new Error('Transactions are unavailable');
    const { service } = buildService(persistence, {
      transactionStrategy: 'auto',
    });

    const result = await service.execute(operationInput(), aggregate());

    expect(result.status).toBe('completed');
    expect(persistence.operations.get('operation-1').status).toBe('completed');
  });

  it('retains failed-retryable state and resumes without duplicating applied work', async () => {
    const { service, persistence } = buildService();
    const firstAggregate = aggregate();
    firstAggregate.apply.mockRejectedValueOnce(new Error('temporary outage'));

    await expect(
      service.execute(operationInput(), firstAggregate),
    ).rejects.toThrow('temporary outage');
    expect(persistence.operations.get('operation-1').status).toBe(
      'failed-retryable',
    );

    const resumedAggregate = aggregate();
    const result = await service.reconcile(operationInput(), resumedAggregate);
    expect(result.status).toBe('completed');
    expect(resumedAggregate.apply).toHaveBeenCalledTimes(1);
  });

  it('persists the terminal event before making the operation TTL eligible', async () => {
    const { service, persistence } = buildService();

    await service.execute(operationInput(), aggregate());

    expect(persistence.order).toEqual(['terminal-event', 'terminal-state']);
    expect(persistence.operations.get('operation-1').expiresAt).toBeInstanceOf(
      Date,
    );
  });

  it('does not set expiresAt while terminal cleanup remains pending', async () => {
    const { service, persistence } = buildService();

    await service.execute(
      operationInput({ cleanupStatus: 'pending' }),
      aggregate(),
    );

    expect(persistence.operations.get('operation-1').expiresAt).toBeUndefined();
  });

  it.each([
    ['completed', 'success', 202],
    ['failed-terminal', 'failure', 422],
  ] as const)(
    'replays retained %s results with their original HTTP status',
    async (status, outcome, httpStatus) => {
      const persistence = new MemoryPersistence();
      persistence.operations.set('operation-1', {
        operationId: 'operation-1',
        operationType: 'claim',
        status,
        assignments: [{ ...assignment(), status: 'applied' }],
        result: { outcome, reasonCategory: 'stored-result', httpStatus },
      });
      const { service, security } = buildService(persistence);
      const aggregateAdapter = aggregate();

      const result = await service.execute(operationInput(), aggregateAdapter);

      expect(result).toEqual(
        expect.objectContaining({ status, httpStatus, replayed: true }),
      );
      expect(aggregateAdapter.apply).not.toHaveBeenCalled();
      expect(security.recordIdentifierOperationTerminal).not.toHaveBeenCalled();
    },
  );

  it('fails closed for pending and incomplete activation-gated reservations', async () => {
    const persistence = new MemoryPersistence();
    persistence.identifiers.set('pending', {
      _id: 'pending',
      normalizedIdentifier: 'pending@example.test',
      subjectType: 'member',
      subjectId: 'member-pending',
      status: 'pending',
    });
    persistence.identifiers.set('gated', {
      _id: 'gated',
      normalizedIdentifier: 'gated@example.test',
      subjectType: 'member',
      subjectId: 'member-gated',
      status: 'active',
      activationGateOperationId: 'repair-1',
    });
    persistence.operations.set('repair-1', {
      operationId: 'repair-1',
      status: 'applying',
    });
    const { service } = buildService(persistence);

    await expect(
      service.resolveActiveIdentifier('pending@example.test'),
    ).resolves.toBeNull();
    await expect(
      service.resolveActiveIdentifier('gated@example.test'),
    ).resolves.toBeNull();
  });

  it('compensates applied assignments in reverse and retains terminal failure', async () => {
    const { service, persistence } = buildService();
    const aggregateAdapter = aggregate();
    aggregateAdapter.apply
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('second assignment failed'));

    const result = await service.execute(
      operationInput({
        assignments: [assignment(1), assignment(2)],
        compensateOnFailure: true,
        failureHttpStatus: 409,
      }),
      aggregateAdapter,
    );

    expect(result.status).toBe('failed-terminal');
    expect(aggregateAdapter.compensate).toHaveBeenCalledTimes(1);
    expect(aggregateAdapter.compensate).toHaveBeenCalledWith(
      expect.objectContaining({ assignmentId: 'assignment-1' }),
      expect.any(Object),
    );
    expect(persistence.operations.get('operation-1').status).toBe(
      'failed-terminal',
    );
  });

  it('reattaches a pending reservation reference when resuming after a crash', async () => {
    const persistence = new MemoryPersistence();
    persistence.operations.set('operation-1', {
      operationId: 'operation-1',
      operationType: 'claim',
      status: 'applying',
      assignments: [{ ...assignment(), status: 'pending' }],
    });
    persistence.identifiers.set('reservation-1', {
      _id: 'reservation-1',
      normalizedIdentifier: assignment().normalizedIdentifier,
      subjectType: 'member',
      subjectId: 'member-1',
      status: 'pending',
      pendingOperationId: 'operation-1',
      pendingAction: 'claim',
    });
    const { service } = buildService(persistence);

    await service.reconcile(operationInput(), aggregate());

    expect(
      persistence.operations.get('operation-1').assignments[0]
        .targetReservationId,
    ).toBe('reservation-1');
  });

  it('retains a compensated terminal intent across a finalizing retry', async () => {
    const persistence = new MemoryPersistence();
    persistence.operations.set('operation-1', {
      operationId: 'operation-1',
      operationType: 'claim',
      status: 'finalizing',
      assignments: [{ ...assignment(), status: 'compensated' }],
      result: {
        outcome: 'failure',
        reasonCategory: 'identifier-operation-compensated',
        httpStatus: 409,
      },
    });
    const { service } = buildService(persistence);

    const result = await service.reconcile(operationInput(), aggregate());

    expect(result.status).toBe('failed-terminal');
    expect(result.result.outcome).toBe('failure');
  });
});
