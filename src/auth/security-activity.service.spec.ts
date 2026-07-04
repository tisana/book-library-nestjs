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
});
