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
          email: 'reader@example.test',
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
