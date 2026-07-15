import { ConfigService } from '@nestjs/config';
import {
  AuthIdentifierRepairKeyPolicyService,
  REPAIR_KEY_POLICY_INDEX,
  THROTTLE_KEY_POLICY_INDEX,
} from './auth-identifier-repair-key-policy.service';

class QueryModel {
  rows: Array<Record<string, unknown>> = [];
  readonly calls: Array<{
    filter: Record<string, unknown>;
    projection?: Record<string, number>;
    hint?: Record<string, number>;
  }> = [];

  find(filter: Record<string, unknown>) {
    const call = { filter } as (typeof this.calls)[number];
    this.calls.push(call);
    const query = {
      select: (projection: Record<string, number>) => {
        call.projection = projection;
        return query;
      },
      hint: (hint: Record<string, number>) => {
        call.hint = hint;
        return query;
      },
      lean: () => query,
      exec: async () => this.rows,
    };
    return query;
  }
}

describe('AuthIdentifierRepairKeyPolicyService', () => {
  let operations: QueryModel;
  let throttles: QueryModel;
  let config: Record<string, unknown>;
  let service: AuthIdentifierRepairKeyPolicyService;

  beforeEach(() => {
    operations = new QueryModel();
    throttles = new QueryModel();
    config = {
      'auth.auditCorrelationKeyVersion': 3,
      'auth.auditCorrelationSecret': 'current-secret',
      'auth.auditCorrelationPreviousKeys': {
        1: 'previous-one',
        2: 'previous-two',
      },
    };
    service = new AuthIdentifierRepairKeyPolicyService(
      operations as never,
      throttles as never,
      { get: (key: string) => config[key] } as ConfigService,
    );
  });

  it('uses the required indexes and returns sorted unique required versions', async () => {
    operations.rows = [
      { manifestKeyVersion: 2 },
      { manifestKeyVersion: 1 },
      { manifestKeyVersion: 2 },
    ];
    throttles.rows = [{ keyVersion: 3 }, { keyVersion: 2 }];

    await expect(service.getRequiredKeyVersions()).resolves.toEqual({
      repairVersions: [1, 2],
      throttleVersions: [2, 3],
      requiredVersions: [1, 2, 3],
    });
    expect(operations.calls[0].hint).toEqual(REPAIR_KEY_POLICY_INDEX);
    expect(operations.calls[0].filter).toMatchObject({
      operationType: 'offline-repair',
      manifestKeyVersion: { $exists: true },
    });
    expect(throttles.calls[0].hint).toEqual(THROTTLE_KEY_POLICY_INDEX);
    expect(throttles.calls[0].filter).toMatchObject({
      keyVersion: { $exists: true },
      expiresAt: { $gt: expect.any(Date) },
    });
  });

  it('reports missing repair keys before missing throttle keys', async () => {
    operations.rows = [{ manifestKeyVersion: 7 }];
    throttles.rows = [{ keyVersion: 8 }];

    await expect(service.evaluateReadiness()).resolves.toEqual({
      ready: false,
      reason: 'repair-key-required',
      requiredVersions: [7, 8],
      requiredVersionCount: 2,
      missingVersions: [7, 8],
    });
  });

  it('denies affected workers and throttle requests without issuing writes', () => {
    expect(service.repairWorkerDecision(9)).toEqual({
      allowed: false,
      reason: 'repair-key-required',
      requiredVersion: 9,
    });
    expect(service.throttleRequestDecision(8)).toEqual({
      allowed: false,
      reason: 'throttle-key-required',
      requiredVersion: 8,
    });
    expect(operations.calls).toHaveLength(0);
    expect(throttles.calls).toHaveLength(0);
  });

  it('recovers immediately when required key material is restored', async () => {
    operations.rows = [{ manifestKeyVersion: 7 }];

    await expect(service.evaluateReadiness()).resolves.toMatchObject({
      ready: false,
      reason: 'repair-key-required',
    });

    config['auth.auditCorrelationPreviousKeys'] = {
      1: 'previous-one',
      2: 'previous-two',
      7: 'restored',
    };

    await expect(service.evaluateReadiness()).resolves.toMatchObject({
      ready: true,
      reason: 'ready',
      missingVersions: [],
    });
  });

  it('allows exactly two required previous keys and blocks three', async () => {
    operations.rows = [{ manifestKeyVersion: 1 }];
    throttles.rows = [{ keyVersion: 2 }];

    await expect(
      service.preflightRotation({
        candidateCurrentVersion: 4,
        candidatePreviousVersions: [],
      }),
    ).resolves.toEqual({
      status: 'ok',
      requiredPreviousVersions: [1, 2],
      requiredPreviousCount: 2,
      maxPreviousKeys: 2,
    });

    throttles.rows.push({ keyVersion: 3 });
    await expect(
      service.preflightRotation({
        candidateCurrentVersion: 4,
        candidatePreviousVersions: [],
      }),
    ).resolves.toEqual({
      status: 'blocked',
      reason: 'repair-key-rotation-blocked',
      requiredPreviousVersions: [1, 2, 3],
      requiredPreviousCount: 3,
      maxPreviousKeys: 2,
    });
  });

  it('keeps an unexpired throttle version through rotation without exposing keys', async () => {
    throttles.rows = [{ keyVersion: 2 }];

    expect(service.throttleRequestDecision(2)).toEqual({
      allowed: true,
      reason: 'ready',
      requiredVersion: 2,
    });
    const result = await service.preflightRotation({
      candidateCurrentVersion: 4,
      candidatePreviousVersions: [3],
    });

    expect(result).toEqual({
      status: 'ok',
      requiredPreviousVersions: [2, 3],
      requiredPreviousCount: 2,
      maxPreviousKeys: 2,
    });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('bucket');
  });
});
