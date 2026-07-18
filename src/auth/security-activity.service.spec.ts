import {
  SecurityActivityActorType,
  SecurityActivityEventType,
  SecurityActivityOutcome,
} from './schemas/security-activity-event.schema';
import { SecurityActivityService } from './security-activity.service';

describe('SecurityActivityService', () => {
  it('redacts passwords, tokens, cookies, and nested secrets before persistence', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const service = new SecurityActivityService({ create } as any);

    await service.record({
      eventType: SecurityActivityEventType.SignInFailure,
      actorType: SecurityActivityActorType.Unknown,
      outcome: SecurityActivityOutcome.Failure,
      context: {
        email: 'reader@example.test',
        password: 'plain-text-password',
        authorization: 'Bearer raw-token',
        nested: {
          refreshToken: 'raw-refresh-token',
          cookie: 'refresh=raw',
          safe: 'kept',
        },
      },
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          email: '[REDACTED]',
          password: '[REDACTED]',
          authorization: '[REDACTED]',
          nested: {
            refreshToken: '[REDACTED]',
            cookie: '[REDACTED]',
            safe: 'kept',
          },
        },
      }),
    );
  });

  it('stores only an opaque subject reference for an exactly resolved failed sign-in', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const service = new SecurityActivityService({ create } as any, {
      get: jest.fn(),
    } as any);

    await service.recordFailedSignIn({
      normalizedIdentifier: 'reader@example.test',
      subject: { subjectType: 'member', subjectId: 'member-opaque-id' },
      reasonCategory: 'invalid-credentials',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectType: 'member',
        subjectId: 'member-opaque-id',
        reasonCategory: 'invalid-credentials',
      }),
    );
    const persisted = create.mock.calls[0][0];
    expect(persisted).not.toHaveProperty('identifierCorrelationHash');
    expect(JSON.stringify(persisted)).not.toContain('reader@example.test');
  });

  it('stores only versioned HMAC correlation for unresolved or ambiguous sign-in identifiers', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'auth.auditCorrelationKeyRing') {
          return {
            currentVersion: 7,
            keysByVersion: { 7: Buffer.alloc(32, 7).toString('base64url') },
          };
        }
        return undefined;
      }),
    };
    const service = new SecurityActivityService({ create } as any, config as any);

    await service.recordFailedSignIn({
      normalizedIdentifier: 'shared@example.test',
      reasonCategory: 'identifier-ambiguous',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationKeyVersion: 7,
        identifierCorrelationHash: expect.stringMatching(/^[A-Za-z0-9_-]+$/),
      }),
    );
    const persisted = create.mock.calls[0][0];
    expect(persisted).not.toHaveProperty('subjectId');
    expect(JSON.stringify(persisted)).not.toContain('shared@example.test');
  });

  it('keeps equal identifiers correlated and changes correlation after key rotation', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    let ring: {
      currentVersion: number;
      keysByVersion: Record<number, string>;
    } = {
      currentVersion: 7,
      keysByVersion: { 7: Buffer.alloc(32, 7).toString('base64url') },
    };
    const config = {
      get: jest.fn((key: string) =>
        key === 'auth.auditCorrelationKeyRing' ? ring : undefined,
      ),
    };
    const service = new SecurityActivityService({ create } as any, config as any);

    await service.recordFailedSignIn({
      normalizedIdentifier: 'same@example.test',
      reasonCategory: 'identifier-unresolved',
    });
    await service.recordFailedSignIn({
      normalizedIdentifier: 'same@example.test',
      reasonCategory: 'identifier-ambiguous',
    });
    const first = create.mock.calls[0][0];
    const second = create.mock.calls[1][0];
    expect(second.identifierCorrelationHash).toBe(
      first.identifierCorrelationHash,
    );

    ring = {
      currentVersion: 8,
      keysByVersion: { 8: Buffer.alloc(32, 8).toString('base64url') },
    };
    await service.recordFailedSignIn({
      normalizedIdentifier: 'same@example.test',
      reasonCategory: 'identifier-unresolved',
    });
    expect(create.mock.calls[2][0]).toMatchObject({ correlationKeyVersion: 8 });
    expect(create.mock.calls[2][0].identifierCorrelationHash).not.toBe(
      first.identifierCorrelationHash,
    );
  });

  it('rejects caller-supplied ordinary identifier hashes', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const service = new SecurityActivityService({ create } as any);

    await expect(
      service.record({
        eventType: SecurityActivityEventType.SignInFailure,
        outcome: SecurityActivityOutcome.Failure,
        reasonCategory: 'invalid-credentials',
        identifierCorrelationHash: 'ordinary-sha256-value',
        correlationKeyVersion: 1,
      }),
    ).rejects.toThrow(
      'Identifier correlation must be derived by SecurityActivityService',
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses to persist browser-origin denials', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const service = new SecurityActivityService({ create } as any);

    await expect(
      service.record({
        eventType: SecurityActivityEventType.AuthorizationDenied,
        outcome: SecurityActivityOutcome.Denied,
        reasonCategory: 'browser-origin-untrusted',
        persistenceBoundary: 'browser-origin-denial',
      }),
    ).rejects.toThrow('Browser-origin denials are operational telemetry only');
    expect(create).not.toHaveBeenCalled();
  });

  it('filters, sorts, and paginates safe security activity views', async () => {
    const exec = jest.fn().mockResolvedValue([
      {
        _id: { toString: () => 'event-1' },
        eventType: SecurityActivityEventType.AuthorizationDenied,
        actorType: SecurityActivityActorType.Member,
        actorId: 'member-1',
        outcome: SecurityActivityOutcome.Denied,
        context: { password: 'must-not-leak', action: 'catalog:manage' },
        createdAt: new Date('2026-07-18T01:00:00.000Z'),
      },
    ]);
    const lean = jest.fn().mockReturnValue({ exec });
    const limit = jest.fn().mockReturnValue({ lean });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    const find = jest.fn().mockReturnValue({ sort });
    const countExec = jest.fn().mockResolvedValue(1);
    const countDocuments = jest.fn().mockReturnValue({ exec: countExec });
    const service = new SecurityActivityService({ find, countDocuments } as any);

    const result = await service.list({
      eventType: SecurityActivityEventType.AuthorizationDenied,
      actorType: SecurityActivityActorType.Member,
      outcome: SecurityActivityOutcome.Denied,
      operationId: 'operation-1',
      page: 2,
      limit: 50,
    });

    const expectedFilter = {
      eventType: { $eq: SecurityActivityEventType.AuthorizationDenied },
      actorType: { $eq: SecurityActivityActorType.Member },
      outcome: { $eq: SecurityActivityOutcome.Denied },
      operationId: { $eq: 'operation-1' },
    };
    expect(find).toHaveBeenCalledWith(expectedFilter);
    expect(countDocuments).toHaveBeenCalledWith(expectedFilter);
    expect(sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(skip).toHaveBeenCalledWith(50);
    expect(limit).toHaveBeenCalledWith(50);
    expect(result).toMatchObject({ page: 2, limit: 50, total: 1, totalPages: 1 });
    expect(result.items[0]).toMatchObject({ id: 'event-1' });
    expect(result.items[0].context).toEqual({
      password: '[REDACTED]',
      action: 'catalog:manage',
    });
  });

  it('upserts deterministic terminal events without duplicate persistence', async () => {
    const updateOne = jest.fn().mockResolvedValue({ acknowledged: true });
    const service = new SecurityActivityService({ updateOne } as any);

    const firstEventId = await service.recordIdentifierOperationTerminal({
      operationId: 'operation-1',
      operationType: 'resolve-conflict',
      terminalStatus: 'completed',
      actor: {
        actorType: SecurityActivityActorType.Staff,
        actorId: 'admin-1',
      },
      outcome: SecurityActivityOutcome.Success,
      reasonCategory: 'identifier-conflict-resolved',
    });
    const secondEventId = await service.recordIdentifierOperationTerminal({
      operationId: 'operation-1',
      operationType: 'resolve-conflict',
      terminalStatus: 'completed',
      actor: {
        actorType: SecurityActivityActorType.Staff,
        actorId: 'admin-1',
      },
      outcome: SecurityActivityOutcome.Success,
      reasonCategory: 'identifier-conflict-resolved',
    });

    expect(firstEventId).toBe(
      'auth-identifier-operation:operation-1:completed',
    );
    expect(secondEventId).toBe(firstEventId);
    expect(updateOne).toHaveBeenNthCalledWith(
      1,
      { eventId: firstEventId },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          eventId: firstEventId,
          targetId: 'operation-1',
        }),
      }),
      expect.objectContaining({ upsert: true }),
    );
  });

  it('treats a duplicate event id race as an idempotent success', async () => {
    const updateOne = jest
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('duplicate'), { code: 11000 }),
      );
    const service = new SecurityActivityService({ updateOne } as any);

    await expect(
      service.recordIdentifierOperationTerminal({
        operationId: 'operation-1',
        operationType: 'claim',
        terminalStatus: 'failed-terminal',
        outcome: SecurityActivityOutcome.Failure,
        reasonCategory: 'identifier-operation-compensated',
      }),
    ).resolves.toBe('auth-identifier-operation:operation-1:failed-terminal');
  });

  it('records a redacted deterministic repair-resume event with safe actors only', async () => {
    const updateOne = jest.fn().mockResolvedValue({ acknowledged: true });
    const service = new SecurityActivityService({ updateOne } as any);

    const eventId = await service.recordIdentifierRepairResumed({
      operationId: 'repair-1',
      resumeId: 'resume-2',
      originalActor: {
        actorType: SecurityActivityActorType.Staff,
        actorId: 'admin-original',
      },
      resumingActor: {
        actorType: SecurityActivityActorType.Staff,
        actorId: 'admin-resuming',
      },
    });

    expect(eventId).toBe('identifier-repair-resumed:repair-1:resume-2');
    expect(updateOne).toHaveBeenCalledWith(
      { eventId },
      {
        $setOnInsert: expect.objectContaining({
          eventId,
          context: {
            originalActor: {
              actorType: SecurityActivityActorType.Staff,
              actorId: 'admin-original',
            },
            resumingActor: {
              actorType: SecurityActivityActorType.Staff,
              actorId: 'admin-resuming',
            },
          },
        }),
      },
      expect.objectContaining({ upsert: true }),
    );
    const persistedEvent = JSON.stringify(updateOne.mock.calls);
    expect(persistedEvent).not.toContain('reader@example.test');
    expect(persistedEvent).not.toContain('plain-text-password');
    expect(persistedEvent).not.toContain('raw-token');
  });
});
