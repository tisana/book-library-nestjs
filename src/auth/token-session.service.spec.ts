import { UnauthorizedException } from '@nestjs/common';
import {
  AuthSubjectType,
  RefreshTokenFamilyStatus,
} from './schemas/refresh-token-family.schema';
import { TokenSessionService } from './token-session.service';

function matches(document: Record<string, any>, filter: Record<string, any>) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = document[key];
    if (
      expected &&
      typeof expected === 'object' &&
      !(expected instanceof Date)
    ) {
      if ('$gt' in expected && !(actual > expected.$gt)) return false;
      if ('$lte' in expected && !(actual <= expected.$lte)) return false;
      return true;
    }
    return actual === expected;
  });
}

function applyUpdate(
  document: Record<string, any>,
  update: Record<string, any>,
) {
  Object.assign(document, update.$set ?? {});
  for (const key of Object.keys(update.$unset ?? {})) delete document[key];
}

class FakeQuery<T> {
  constructor(
    private readonly values: T[],
    private readonly owner?: FakeModel,
  ) {}

  sort() {
    return this;
  }

  limit(limit: number) {
    if (this.owner) this.owner.lastLimit = limit;
    this.values.splice(limit);
    return this;
  }

  async exec(): Promise<T[]> {
    return this.values;
  }
}

class FakeModel {
  documents: Record<string, any>[] = [];
  failNextCreate = false;
  failNextCommit = false;
  failNextCas = false;
  lastLimit?: number;

  async create(document: Record<string, any>) {
    if (this.failNextCreate) {
      this.failNextCreate = false;
      throw new Error('write failed');
    }
    if (
      this.documents.some(
        (candidate) =>
          (document.tokenHash && candidate.tokenHash === document.tokenHash) ||
          (document.rotationOperationId &&
            candidate.rotationOperationId === document.rotationOperationId),
      )
    ) {
      throw Object.assign(new Error('duplicate'), { code: 11000 });
    }
    const stored = { ...document };
    this.documents.push(stored);
    return stored;
  }

  findOne(filter: Record<string, any>) {
    return {
      exec: async () => this.documents.find((value) => matches(value, filter)),
    };
  }

  findOneAndUpdate(filter: Record<string, any>, update: Record<string, any>) {
    return {
      exec: async () => {
        if (update.$set?.lastRotationOperationId && this.failNextCas) {
          this.failNextCas = false;
          throw new Error('uncertain CAS');
        }
        if (update.$set?.status === 'committed' && this.failNextCommit) {
          this.failNextCommit = false;
          throw new Error('commit failed');
        }
        const document = this.documents.find((value) => matches(value, filter));
        if (!document) return null;
        applyUpdate(document, update);
        return document;
      },
    };
  }

  find(filter: Record<string, any>) {
    return new FakeQuery(
      this.documents.filter((value) => matches(value, filter)),
      this,
    );
  }

  async updateMany(filter: Record<string, any>, update: Record<string, any>) {
    const documents = this.documents.filter((value) => matches(value, filter));
    documents.forEach((document) => applyUpdate(document, update));
    return { modifiedCount: documents.length };
  }
}

describe('TokenSessionService', () => {
  let families: FakeModel;
  let markers: FakeModel;
  let service: TokenSessionService;

  const createFamily = (subjectId = 'staff-user-id', ttlSeconds = 600) =>
    service.createFamily({
      clientId: 'web',
      subjectType: AuthSubjectType.Staff,
      subjectId,
      scopes: ['catalog:read'],
      authVersion: 0,
      ttlSeconds,
    });

  beforeEach(() => {
    families = new FakeModel();
    markers = new FakeModel();
    service = new TokenSessionService(families as never, markers as never);
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('stores only hashes and caps immutable family expiry at 30 days', async () => {
    const before = Date.now();
    const result = await createFamily('staff-user-id', 9_999_999);
    const family = families.documents[0];

    expect(family.currentTokenHash).toHaveLength(64);
    expect(family.currentTokenHash).not.toBe(result.refreshToken);
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(
      before + 2_592_000_000 + 100,
    );
  });

  it('commits a hash-only marker after operation-correlated family CAS', async () => {
    const created = await createFamily();
    const immutableExpiry = created.expiresAt.getTime();
    const rotated = await service.rotate(created.refreshToken);
    const family = families.documents[0];
    const marker = markers.documents[0];

    expect(family.currentTokenHash).toBe(
      service.hashRefreshToken(rotated.refreshToken),
    );
    expect(family.lastRotationOperationId).toBe(marker.rotationOperationId);
    expect(marker).toEqual(
      expect.objectContaining({
        tokenHash: service.hashRefreshToken(created.refreshToken),
        familyId: family.familyId,
        status: 'committed',
      }),
    );
    expect(marker).not.toHaveProperty('refreshToken');
    expect(marker).not.toHaveProperty('leaseExpiresAt');
    expect(rotated.expiresAt.getTime()).toBe(immutableExpiry);
  });

  it('leaves the family unchanged when pending marker insertion fails', async () => {
    const created = await createFamily();
    const originalHash = families.documents[0].currentTokenHash;
    markers.failNextCreate = true;

    await expect(service.rotate(created.refreshToken)).rejects.toEqual(
      new UnauthorizedException('Invalid refresh session'),
    );
    expect(families.documents[0].currentTokenHash).toBe(originalHash);
    expect(families.documents[0].status).toBe(RefreshTokenFamilyStatus.Active);
  });

  it('denies an active pending lease without mutating the family', async () => {
    const created = await createFamily();
    const family = families.documents[0];
    markers.documents.push({
      tokenHash: service.hashRefreshToken(created.refreshToken),
      familyId: family.familyId,
      status: 'pending',
      rotationOperationId: 'other-owner',
      leaseExpiresAt: new Date(Date.now() + 30_000),
      expiresAt: family.expiresAt,
    });

    await expect(service.rotate(created.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(family.currentTokenHash).toBe(
      service.hashRefreshToken(created.refreshToken),
    );
    expect(family).not.toHaveProperty('lastRotationOperationId');
  });

  it('takes over an expired pre-CAS lease and rotates once', async () => {
    const created = await createFamily();
    const family = families.documents[0];
    markers.documents.push({
      tokenHash: service.hashRefreshToken(created.refreshToken),
      familyId: family.familyId,
      status: 'pending',
      rotationOperationId: 'expired-owner',
      leaseExpiresAt: new Date(Date.now() - 1),
      expiresAt: family.expiresAt,
    });

    await service.rotate(created.refreshToken);
    expect(markers.documents[0].status).toBe('committed');
    expect(markers.documents[0].rotationOperationId).not.toBe('expired-owner');
    expect(family.lastRotationOperationId).toBe(
      markers.documents[0].rotationOperationId,
    );
  });

  it('revokes on replay from any committed generation', async () => {
    const created = await createFamily();
    const firstRotation = await service.rotate(created.refreshToken);
    await service.rotate(firstRotation.refreshToken);

    await expect(service.rotate(created.refreshToken)).rejects.toEqual(
      new UnauthorizedException('Invalid refresh session'),
    );
    expect(families.documents[0].status).toBe(
      RefreshTokenFamilyStatus.Replayed,
    );
    expect(families.documents[0].revokedReason).toBe('refresh-token-replay');
  });

  it('allows at most one successor under concurrent exchange', async () => {
    const created = await createFamily();
    const outcomes = await Promise.allSettled([
      service.rotate(created.refreshToken),
      service.rotate(created.refreshToken),
    ]);

    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(markers.documents).toHaveLength(1);
  });

  it('fails closed when marker commitment is interrupted after family CAS', async () => {
    const created = await createFamily();
    markers.failNextCommit = true;

    await expect(service.rotate(created.refreshToken)).rejects.toEqual(
      new UnauthorizedException('Invalid refresh session'),
    );
    expect(families.documents[0].status).toBe(RefreshTokenFamilyStatus.Revoked);
    expect(families.documents[0].revokedReason).toBe(
      'refresh-rotation-orphaned',
    );
    expect(markers.documents[0].status).toBe('pending');
  });

  it('leaves a confirmed pre-CAS interruption pending for lease takeover', async () => {
    const created = await createFamily();
    const originalHash = families.documents[0].currentTokenHash;
    families.failNextCas = true;

    await expect(service.rotate(created.refreshToken)).rejects.toEqual(
      new UnauthorizedException('Invalid refresh session'),
    );
    expect(families.documents[0].status).toBe(RefreshTokenFamilyStatus.Active);
    expect(families.documents[0].currentTokenHash).toBe(originalHash);
    expect(markers.documents[0].status).toBe('pending');

    markers.documents[0].leaseExpiresAt = new Date(Date.now() - 1);
    await expect(service.rotate(created.refreshToken)).resolves.toEqual(
      expect.objectContaining({ familyId: families.documents[0].familyId }),
    );
  });

  it('reconciles orphaned rotations and leaves expired pre-CAS work for takeover', async () => {
    const orphaned = await createFamily('orphaned');
    const available = await createFamily('available');
    const orphanedFamily = families.documents[0];
    const availableFamily = families.documents[1];
    orphanedFamily.currentTokenHash = 'successor-hash';
    orphanedFamily.lastRotationOperationId = 'orphan-op';
    markers.documents.push(
      {
        tokenHash: service.hashRefreshToken(orphaned.refreshToken),
        familyId: orphanedFamily.familyId,
        status: 'pending',
        rotationOperationId: 'orphan-op',
        leaseExpiresAt: new Date(Date.now() - 1),
        expiresAt: orphanedFamily.expiresAt,
      },
      {
        tokenHash: service.hashRefreshToken(available.refreshToken),
        familyId: availableFamily.familyId,
        status: 'pending',
        rotationOperationId: 'pre-cas-op',
        leaseExpiresAt: new Date(Date.now() - 1),
        expiresAt: availableFamily.expiresAt,
      },
    );

    expect(await service.reconcileExpiredPendingMarkers()).toBe(1);
    expect(markers.lastLimit).toBe(100);
    expect(markers.documents[0].status).toBe('committed');
    expect(orphanedFamily.status).toBe(RefreshTokenFamilyStatus.Revoked);
    expect(markers.documents[1].status).toBe('pending');
    expect(availableFamily.status).toBe(RefreshTokenFamilyStatus.Active);
  });

  it('runs bounded reconciliation every 60 seconds and stops on destroy', async () => {
    jest.useFakeTimers();
    const reconcile = jest
      .spyOn(service, 'reconcileExpiredPendingMarkers')
      .mockResolvedValue(0);

    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(reconcile).toHaveBeenCalledTimes(1);
    service.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it('uses remaining lifetime and strict host-only cookie parity', () => {
    const now = new Date('2026-07-15T00:00:00Z');
    const options = service.getRefreshCookieOptions(
      new Date(now.getTime() + 12_345),
      true,
      now,
    );
    const clear = service.getClearRefreshCookieOptions(true);

    expect(options).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/auth',
      maxAge: 12_345,
    });
    expect(options).not.toHaveProperty('domain');
    expect(clear).toEqual({ ...options, maxAge: 0 });
  });

  it('revokes current and all subject sessions without exposing token hashes', async () => {
    const current = await createFamily('same-subject');
    await createFamily('same-subject');

    await service.revokeRefreshToken(current.refreshToken, 'sign-out');
    expect(families.documents[0].status).toBe(RefreshTokenFamilyStatus.Revoked);
    expect(families.documents[1].status).toBe(RefreshTokenFamilyStatus.Active);

    await service.revokeSubject(
      AuthSubjectType.Staff,
      'same-subject',
      'sign-out-all',
    );
    expect(families.documents[1].status).toBe(RefreshTokenFamilyStatus.Revoked);
    expect(families.documents[1]).not.toHaveProperty('currentTokenHash');
  });
});
