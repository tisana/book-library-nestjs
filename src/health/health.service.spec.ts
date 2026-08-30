import { HttpException } from '@nestjs/common';
import { Connection } from 'mongoose';

import {
  AuthReadinessKeyPolicy,
  HealthService,
} from './health.service';

describe('HealthService public health and readiness contracts', () => {
  const createConnection = (options?: {
    readyState?: number;
    ping?: () => Promise<unknown>;
    withDatabase?: boolean;
  }) =>
    ({
      readyState: options?.readyState ?? 1,
      db:
        options?.withDatabase === false
          ? undefined
          : {
              admin: () => ({
                ping: options?.ping ?? (() => Promise.resolve({ ok: 1 })),
              }),
            },
    }) as unknown as Connection;

  const createService = (options?: {
    connection?: Connection;
    policy?: AuthReadinessKeyPolicy;
  }) =>
    new HealthService(
      options?.connection ?? createConnection(),
      options?.policy,
    );

  const expectReadinessReason = async (
    service: HealthService,
    reason: string,
  ) => {
    try {
      await service.getReadiness();
      throw new Error('expected readiness to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getResponse()).toEqual({
        status: 'error',
        reason,
      });
    }
  };

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('returns a current timestamp and rounded process uptime for liveness', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T10:20:30.000Z'));
    jest.spyOn(process, 'uptime').mockReturnValue(12.6);

    expect(createService().getHealth()).toEqual({
      status: 'ok',
      timestamp: '2026-08-01T10:20:30.000Z',
      uptimeSeconds: 13,
    });
  });

  it('reports the redacted database reason while disconnected', async () => {
    await expectReadinessReason(
      createService({ connection: createConnection({ readyState: 0 }) }),
      'database-unavailable',
    );
  });

  it('reports the redacted database reason when a connected driver has no database handle', async () => {
    await expectReadinessReason(
      createService({ connection: createConnection({ withDatabase: false }) }),
      'database-unavailable',
    );
  });

  it('reports the redacted database reason when ping rejects', async () => {
    await expectReadinessReason(
      createService({
        connection: createConnection({
          ping: () => Promise.reject(new Error('driver unavailable')),
        }),
      }),
      'database-unavailable',
    );
  });

  it('reports the redacted database reason when ping exceeds the readiness timeout', async () => {
    jest.useFakeTimers();
    const service = createService({
      connection: createConnection({ ping: () => new Promise(() => undefined) }),
    });
    const expectation = expectReadinessReason(service, 'database-unavailable');

    await jest.advanceTimersByTimeAsync(4_000);

    await expectation;
  });

  it('reports readiness when the database succeeds and no auth policy is registered', async () => {
    await expect(createService().getReadiness()).resolves.toEqual({
      status: 'ok',
      checks: { database: 'ok', auth: 'ok' },
    });
  });

  it('reports readiness when the registered auth policy is ready', async () => {
    const policy: AuthReadinessKeyPolicy = {
      evaluateReadiness: () => ({ ready: true }),
    };

    await expect(createService({ policy }).getReadiness()).resolves.toEqual({
      status: 'ok',
      checks: { database: 'ok', auth: 'ok' },
    });
  });

  it('preserves the repair-key-required policy reason in the readiness response', async () => {
    const policy: AuthReadinessKeyPolicy = {
      evaluateReadiness: () => ({ ready: false, reason: 'repair-key-required' }),
    };

    await expectReadinessReason(createService({ policy }), 'repair-key-required');
  });

  it('maps an unknown auth policy reason to the redacted infrastructure reason', async () => {
    const policy = {
      evaluateReadiness: () => ({ ready: false, reason: 'unexpected-detail' }),
    } as unknown as AuthReadinessKeyPolicy;

    await expectReadinessReason(
      createService({ policy }),
      'auth-infrastructure-unavailable',
    );
  });

  it('maps a rejected auth policy to the redacted infrastructure reason', async () => {
    const policy: AuthReadinessKeyPolicy = {
      evaluateReadiness: () => Promise.reject(new Error('policy failure')),
    };

    await expectReadinessReason(
      createService({ policy }),
      'auth-infrastructure-unavailable',
    );
  });
});
