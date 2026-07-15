import { ConfigService } from '@nestjs/config';
import { AuthSourceIdentityService } from './auth-source-identity.service';
import {
  AuthThrottleDimension,
  AuthThrottleService,
  GenericSignInFailureCategory,
} from './auth-throttle.service';

interface Bucket {
  dimension: AuthThrottleDimension;
  keyVersion: number;
  bucketKey: string;
  count: number;
  windowStartedAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

class FakeQuery<T> {
  constructor(private readonly execute: () => T | Promise<T>) {}

  lean(): this {
    return this;
  }

  exec(): Promise<T> {
    return Promise.resolve(this.execute());
  }
}

class FakeThrottleBucketModel {
  readonly documents: Bucket[] = [];
  writeCount = 0;

  findOneAndUpdate(
    filter: Record<string, any>,
    update: Record<string, any> | Record<string, any>[],
    options: Record<string, any>,
  ): FakeQuery<Bucket | null> {
    return new FakeQuery(() => {
      let bucket = this.documents.find((candidate) =>
        this.matches(candidate, filter),
      );

      if (!bucket && options.upsert) {
        bucket = {
          dimension: filter.dimension,
          keyVersion: filter.keyVersion,
          bucketKey: filter.bucketKey,
          count: 0,
          windowStartedAt: new Date(0),
          expiresAt: new Date(0),
          createdAt: new Date(0),
          updatedAt: new Date(0),
        };
        this.documents.push(bucket);
      }

      if (!bucket) {
        return null;
      }

      this.writeCount += 1;
      if (Array.isArray(update)) {
        this.applyPipeline(bucket, update);
      } else {
        this.applyUpdate(bucket, update);
      }

      return { ...bucket };
    });
  }

  distinct(field: keyof Bucket, filter: Record<string, any>): FakeQuery<any[]> {
    return new FakeQuery(() => [
      ...new Set(
        this.documents
          .filter((document) => this.matches(document, filter))
          .map((document) => document[field]),
      ),
    ]);
  }

  private matches(bucket: Bucket, filter: Record<string, any>): boolean {
    return Object.entries(filter).every(([field, expected]) => {
      if (field === '$or') {
        return (expected as Record<string, any>[]).some((candidate) =>
          this.matches(bucket, candidate),
        );
      }

      const actual = bucket[field as keyof Bucket];
      if (expected && typeof expected === 'object' && '$gt' in expected) {
        return new Date(actual as Date).getTime() > expected.$gt.getTime();
      }

      return actual === expected;
    });
  }

  private applyUpdate(bucket: Bucket, update: Record<string, any>): void {
    for (const [field, amount] of Object.entries(update.$inc ?? {})) {
      (bucket as any)[field] += amount;
    }
    Object.assign(bucket, update.$set ?? {});
  }

  private applyPipeline(
    bucket: Bucket,
    pipeline: Record<string, any>[],
  ): void {
    const values = pipeline[0].$set;
    const active = bucket.expiresAt.getTime() > values.updatedAt.getTime();
    bucket.dimension = values.dimension;
    bucket.keyVersion = values.keyVersion;
    bucket.bucketKey = values.bucketKey;
    bucket.count = active ? bucket.count + 1 : 1;
    bucket.windowStartedAt = active
      ? bucket.windowStartedAt
      : values.windowStartedAt.$cond[2];
    bucket.expiresAt = active ? bucket.expiresAt : values.expiresAt.$cond[2];
    bucket.createdAt = bucket.createdAt.getTime()
      ? bucket.createdAt
      : values.createdAt.$ifNull[1];
    bucket.updatedAt = values.updatedAt;
  }
}

class MutableConfigService {
  constructor(readonly values: Record<string, any>) {}

  get(path: string): unknown {
    return path.split('.').reduce<unknown>((value, key) => {
      if (!value || typeof value !== 'object') {
        return undefined;
      }

      return (value as Record<string, unknown>)[key];
    }, this.values);
  }
}

const secret = (byte: number): string =>
  Buffer.alloc(32, byte).toString('base64url');

function createConfig(): MutableConfigService {
  return new MutableConfigService({
    auth: {
      auditCorrelationKeyVersion: 1,
      auditCorrelationSecret: secret(1),
      auditCorrelationPreviousKeys: {},
      signInIdentifierFailureLimit: 5,
      signInSourceLimit: 20,
      signInWindowSeconds: 900,
      refreshThrottleLimit: 30,
      refreshThrottleWindowSeconds: 300,
      trustedProxyCidrs: [],
    },
  });
}

describe('AuthThrottleService', () => {
  let model: FakeThrottleBucketModel;
  let config: MutableConfigService;
  let service: AuthThrottleService;

  beforeEach(() => {
    model = new FakeThrottleBucketModel();
    config = createConfig();
    service = new AuthThrottleService(
      model as any,
      config as unknown as ConfigService,
    );
  });

  it('denies the sixth identifier-correlated generic failure', async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await expect(
        service.consumeSignInIdentifierFailure(
          'reader@example.com',
          'invalid-password',
        ),
      ).resolves.toEqual({ allowed: true });
    }

    await expect(
      service.consumeSignInIdentifierFailure(
        'reader@example.com',
        'invalid-password',
      ),
    ).resolves.toMatchObject({
      allowed: false,
      reason: 'throttle-limit-exceeded',
    });
  });

  it('denies the twenty-first source sign-in attempt', async () => {
    const decisions = await Promise.all(
      Array.from({ length: 21 }, () =>
        service.consumeSignInAttempt({ sourceIdentity: '198.51.100.8' }),
      ),
    );

    expect(decisions.filter(({ allowed }) => !allowed)).toHaveLength(1);
    expect(model.documents[0].count).toBe(21);
  });

  it('denies the thirty-first refresh family and source attempt', async () => {
    let lastDecision = { allowed: true };

    for (let attempt = 1; attempt <= 31; attempt += 1) {
      lastDecision = await service.consumeRefreshAttempt({
        sourceIdentity: '2001:db8::10',
        familyId: 'family-sensitive-value',
      });
    }

    expect(lastDecision).toMatchObject({
      allowed: false,
      reason: 'throttle-limit-exceeded',
    });
    expect(model.documents.map(({ count }) => count)).toEqual([31, 31]);
  });

  it('counts malformed or unresolved refresh attempts by source only', async () => {
    let lastDecision = { allowed: true };

    for (let attempt = 1; attempt <= 31; attempt += 1) {
      lastDecision = await service.consumeRefreshAttempt({
        sourceIdentity: '198.51.100.15',
      });
    }

    expect(lastDecision).toMatchObject({
      allowed: false,
      reason: 'throttle-limit-exceeded',
    });
    expect(model.documents).toHaveLength(1);
    expect(model.documents[0]).toMatchObject({
      dimension: AuthThrottleDimension.RefreshSource,
      count: 31,
    });
  });

  it.each<GenericSignInFailureCategory>([
    'unknown',
    'ambiguous',
    'invalid-password',
    'inactive',
    'suspended',
    'locked',
    'missing-credential',
  ])('counts the %s generic failure category by identifier', async (category) => {
    await service.consumeSignInAttempt({
      sourceIdentity: '198.51.100.9',
      normalizedIdentifier: `${category}@example.com`,
      failureCategory: category,
    });

    expect(
      model.documents.some(
        ({ dimension }) =>
          dimension === AuthThrottleDimension.SignInIdentifierFailure,
      ),
    ).toBe(true);
  });

  it('counts malformed sign-in requests only by source', async () => {
    await service.consumeSignInAttempt({
      sourceIdentity: '198.51.100.10',
    });

    expect(model.documents).toHaveLength(1);
    expect(model.documents[0].dimension).toBe(
      AuthThrottleDimension.SignInSource,
    );
  });

  it('shares keys across routes and service instances', async () => {
    const otherInstance = new AuthThrottleService(
      model as any,
      config as unknown as ConfigService,
    );
    const attempts = Array.from({ length: 21 }, (_, index) =>
      (index % 2 ? service : otherInstance).consumeSignInAttempt({
        sourceIdentity: '203.0.113.50',
      }),
    );
    const decisions = await Promise.all(attempts);

    expect(decisions.filter(({ allowed }) => !allowed)).toHaveLength(1);
    expect(model.documents).toHaveLength(1);
  });

  it('starts a new window after the configured expiry', async () => {
    const startedAt = new Date('2026-07-15T00:00:00.000Z');
    await service.consumeSignInAttempt(
      { sourceIdentity: '198.51.100.11' },
      startedAt,
    );

    const decision = await service.consumeSignInAttempt(
      { sourceIdentity: '198.51.100.11' },
      new Date(startedAt.getTime() + 900_001),
    );

    expect(decision).toEqual({ allowed: true });
    expect(model.documents[0].count).toBe(1);
  });

  it('continues an unexpired previous-key bucket after rotation', async () => {
    await service.consumeSignInAttempt({ sourceIdentity: '198.51.100.12' });
    config.values.auth.auditCorrelationKeyVersion = 2;
    config.values.auth.auditCorrelationSecret = secret(2);
    config.values.auth.auditCorrelationPreviousKeys = { 1: secret(1) };

    await service.consumeSignInAttempt({ sourceIdentity: '198.51.100.12' });

    expect(model.documents).toHaveLength(1);
    expect(model.documents[0]).toMatchObject({ keyVersion: 1, count: 2 });
  });

  it('fails closed without writes when a referenced key is missing', async () => {
    await service.consumeSignInAttempt({ sourceIdentity: '198.51.100.13' });
    config.values.auth.auditCorrelationKeyVersion = 2;
    config.values.auth.auditCorrelationSecret = secret(2);
    const writesBefore = model.writeCount;

    await expect(
      service.consumeSignInAttempt({ sourceIdentity: '198.51.100.13' }),
    ).resolves.toEqual({
      allowed: false,
      reason: 'throttle-key-required',
    });
    expect(model.writeCount).toBe(writesBefore);
    expect(model.documents[0].count).toBe(1);
  });

  it('fails closed without writes when the current key is unavailable', async () => {
    config.values.auth.auditCorrelationSecret = undefined;

    await expect(
      service.consumeSignInAttempt({ sourceIdentity: '198.51.100.14' }),
    ).resolves.toEqual({
      allowed: false,
      reason: 'throttle-key-required',
    });
    expect(model.writeCount).toBe(0);
    expect(model.documents).toHaveLength(0);
  });

  it('persists no raw identifiers, sources, family ids, or tokens', async () => {
    const identifier = 'private.reader@example.com';
    const sourceIdentity = '203.0.113.77';
    const familyId = 'private-family-id';
    const token = 'private-token-value';

    await service.consumeSignInAttempt({
      sourceIdentity,
      normalizedIdentifier: identifier,
      failureCategory: 'unknown',
    });
    await service.consumeRefreshAttempt({ sourceIdentity, familyId });

    const persisted = JSON.stringify(model.documents);
    for (const rawValue of [identifier, sourceIdentity, familyId, token]) {
      expect(persisted).not.toContain(rawValue);
    }
    expect(model.documents.every(({ bucketKey }) => bucketKey.length === 43)).toBe(
      true,
    );
  });
});

describe('AuthSourceIdentityService', () => {
  function resolver(trustedProxyCidrs: string[]): AuthSourceIdentityService {
    return new AuthSourceIdentityService({
      get: jest.fn().mockReturnValue(trustedProxyCidrs),
    } as unknown as ConfigService);
  }

  it('uses the direct peer and ignores forwarding when the peer is untrusted', () => {
    const service = resolver(['10.0.0.0/8']);

    expect(
      service.resolve({
        socket: { remoteAddress: '203.0.113.1' },
        headers: { 'x-forwarded-for': '198.51.100.20' },
      }),
    ).toBe('203.0.113.1');
  });

  it('resolves a trusted IPv4 chain right-to-left to the first untrusted hop', () => {
    const service = resolver(['10.0.0.0/8']);

    expect(
      service.resolve({
        socket: { remoteAddress: '10.0.0.1' },
        headers: { 'x-forwarded-for': '198.51.100.20, 10.0.0.2' },
      }),
    ).toBe('198.51.100.20');
  });

  it('resolves a trusted IPv6 chain right-to-left to the first untrusted hop', () => {
    const service = resolver(['fd00::/8']);

    expect(
      service.resolve({
        socket: { remoteAddress: 'fd00::1' },
        headers: { 'x-forwarded-for': '2001:db8::20, fd00::2' },
      }),
    ).toBe('2001:db8::20');
  });

  it('falls back to the direct peer for malformed forwarding data', () => {
    const service = resolver(['10.0.0.0/8']);

    expect(
      service.resolve({
        socket: { remoteAddress: '10.0.0.1' },
        headers: { 'x-forwarded-for': 'not-an-address' },
      }),
    ).toBe('10.0.0.1');
  });

  it('canonicalizes IPv4-mapped direct peers', () => {
    expect(
      resolver([]).resolve({ socket: { remoteAddress: '::ffff:127.0.0.1' } }),
    ).toBe('127.0.0.1');
  });
});
