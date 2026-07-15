import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Connection } from 'mongoose';
import * as request from 'supertest';
import { AuthIdentifierRepairKeyPolicyService } from '../src/auth/auth-identifier-repair-key-policy.service';
import { HealthController } from '../src/health/health.controller';
import {
  AuthReadinessKeyPolicy,
  AuthReadinessResult,
  HealthService,
} from '../src/health/health.service';

describe('Health endpoints (e2e)', () => {
  let app: INestApplication;
  let databaseReady: boolean;
  let databaseError: unknown;
  let authResult: AuthReadinessResult;
  let authError: unknown;

  beforeEach(async () => {
    databaseReady = true;
    databaseError = undefined;
    authResult = { ready: true };
    authError = undefined;

    const connection = {
      get readyState() {
        return databaseReady ? 1 : 0;
      },
      db: {
        admin: () => ({
          ping: async () => {
            if (databaseError) {
              throw databaseError;
            }
            return { ok: 1 };
          },
        }),
      },
    } as unknown as Connection;
    const keyPolicy: AuthReadinessKeyPolicy = {
      evaluateReadiness: async () => {
        if (authError) {
          throw authError;
        }
        return authResult;
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: getConnectionToken(), useValue: connection },
        {
          provide: AuthIdentifierRepairKeyPolicyService,
          useValue: keyPolicy,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('exposes public liveness and healthy readiness without credentials', async () => {
    const liveness = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    expect(liveness.body).toMatchObject({ status: 'ok' });

    const readiness = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200);
    expect(readiness.body).toEqual({
      status: 'ok',
      checks: { database: 'ok', auth: 'ok' },
    });
  });

  it('reports runtime database failure within five seconds using redacted output', async () => {
    databaseReady = false;
    databaseError = new Error(
      'mongodb://admin:secret@private-db.example.test/library stack trace',
    );
    const startedAt = Date.now();

    const response = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503);

    expect(Date.now() - startedAt).toBeLessThan(5_000);
    expect(response.body).toEqual({
      status: 'error',
      reason: 'database-unavailable',
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /mongodb|secret|private-db|stack|admin/i,
    );
  });

  it.each(['repair-key-required', 'throttle-key-required'] as const)(
    'fails closed for %s and recovers when the key is restored',
    async (reason) => {
      authResult = { ready: false, reason };

      const unavailable = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(503);
      expect(unavailable.body).toEqual({ status: 'error', reason });

      authResult = { ready: true };
      await request(app.getHttpServer()).get('/health/ready').expect(200);
    },
  );

  it('redacts unexpected auth infrastructure failures', async () => {
    authError = new Error(
      'account member-123 host auth-db.internal secret signing-key stack',
    );

    const response = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503);

    expect(response.body).toEqual({
      status: 'error',
      reason: 'auth-infrastructure-unavailable',
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /member-123|auth-db|secret|signing-key|stack/i,
    );
  });
});
