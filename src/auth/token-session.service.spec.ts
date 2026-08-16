import { Logger, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { deferred } from '../../test/support/backend-coverage-fixtures';
import { createReplayMarker } from '../../test/support/critical-auth-fixtures';
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

  sort(value: Record<string, number>) {
    if (this.owner) this.owner.lastSort = value;
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

class FakeSingleQuery<T> {
  constructor(
    private readonly value: T | undefined,
    private readonly error?: Error,
    private readonly owner?: FakeModel,
  ) {}

  select(projection: Record<string, number>) {
    this.owner?.selectedProjections.push(projection);
    return this;
  }

  lean() {
    return this;
  }

  async exec(): Promise<T | undefined> {
    if (this.error) throw this.error;
    return this.value;
  }
}

class FakeModel {
  documents: Record<string, any>[] = [];
  nextCreate?: (document: Record<string, any>) => Promise<Record<string, any>>;
  nextFindOne?: (
    filter: Record<string, any>,
  ) => Record<string, any> | undefined;
  failNextCreate = false;
  failNextCommit = false;
  failNextCas = false;
  failNextCasAfterUpdate = false;
  onNextCasFailure?: (document: Record<string, any> | undefined) => void;
  returnNullNextCommit = false;
  returnNullNextCas = false;
  returnNullNextTakeover = false;
  failNextFindOne = false;
  lastLimit?: number;
  lastFindFilter?: Record<string, any>;
  lastSort?: Record<string, number>;
  selectedProjections: Record<string, number>[] = [];
  createArguments: Record<string, any>[] = [];
  findOneAndUpdateArguments: unknown[][] = [];
  findOneFilters: Record<string, any>[] = [];
  updateManyArguments: unknown[][] = [];

  async create(document: Record<string, any>) {
    this.createArguments.push(document);
    if (this.nextCreate) {
      const create = this.nextCreate;
      this.nextCreate = undefined;
      return create(document);
    }
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
    this.findOneFilters.push(filter);
    const error = this.failNextFindOne ? new Error('query failed') : undefined;
    this.failNextFindOne = false;
    const findOne = this.nextFindOne;
    this.nextFindOne = undefined;
    return new FakeSingleQuery(
      findOne
        ? findOne(filter)
        : this.documents.find((value) => matches(value, filter)),
      error,
      this,
    );
  }

  findOneAndUpdate(
    filter: Record<string, any>,
    update: Record<string, any>,
    options?: Record<string, any>,
  ) {
    this.findOneAndUpdateArguments.push([filter, update, options]);
    return {
      exec: async () => {
        if (update.$set?.lastRotationOperationId && this.failNextCas) {
          this.failNextCas = false;
          this.onNextCasFailure?.(
            this.documents.find((value) => matches(value, filter)),
          );
          this.onNextCasFailure = undefined;
          throw new Error('uncertain CAS');
        }
        if (
          update.$set?.lastRotationOperationId &&
          this.failNextCasAfterUpdate
        ) {
          this.failNextCasAfterUpdate = false;
          const document = this.documents.find((value) =>
            matches(value, filter),
          );
          if (document) applyUpdate(document, update);
          throw new Error('uncertain CAS');
        }
        if (update.$set?.lastRotationOperationId && this.returnNullNextCas) {
          this.returnNullNextCas = false;
          return null;
        }
        if (
          update.$set?.rotationOperationId &&
          !update.$set?.lastRotationOperationId &&
          this.returnNullNextTakeover
        ) {
          this.returnNullNextTakeover = false;
          return null;
        }
        if (update.$set?.status === 'committed' && this.failNextCommit) {
          this.failNextCommit = false;
          throw new Error('commit failed');
        }
        if (update.$set?.status === 'committed' && this.returnNullNextCommit) {
          this.returnNullNextCommit = false;
          return null;
        }
        const document = this.documents.find((value) => matches(value, filter));
        if (!document) return null;
        applyUpdate(document, update);
        return document;
      },
    };
  }

  find(filter: Record<string, any>) {
    this.lastFindFilter = filter;
    return new FakeQuery(
      this.documents.filter((value) => matches(value, filter)),
      this,
    );
  }

  async updateMany(filter: Record<string, any>, update: Record<string, any>) {
    this.updateManyArguments.push([filter, update]);
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
    const now = new Date('2026-07-15T00:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    const created = await createFamily();
    const immutableExpiry = created.expiresAt.getTime();
    const rotated = await service.rotate(created.refreshToken);
    const family = families.documents[0];
    const marker = markers.documents[0];

    expect(family.currentTokenHash).toBe(
      service.hashRefreshToken(rotated.refreshToken),
    );
    expect(family.lastRotationOperationId).toBe(marker.rotationOperationId);
    expect(families.findOneAndUpdateArguments[0]).toEqual([
      {
        familyId: family.familyId,
        currentTokenHash: service.hashRefreshToken(created.refreshToken),
        status: RefreshTokenFamilyStatus.Active,
        expiresAt: { $gt: expect.any(Date) },
      },
      {
        $set: {
          currentTokenHash: service.hashRefreshToken(rotated.refreshToken),
          lastRotatedAt: expect.any(Date),
          lastRotationOperationId: marker.rotationOperationId,
        },
      },
      { returnDocument: 'after' },
    ]);
    expect(markers.findOneAndUpdateArguments[0]).toEqual([
      {
        tokenHash: service.hashRefreshToken(created.refreshToken),
        status: 'pending',
        rotationOperationId: marker.rotationOperationId,
      },
      {
        $set: { status: 'committed', committedAt: expect.any(Date) },
        $unset: { leaseExpiresAt: 1 },
      },
      { returnDocument: 'after' },
    ]);
    expect(marker).toEqual(
      expect.objectContaining({
        tokenHash: service.hashRefreshToken(created.refreshToken),
        familyId: family.familyId,
        status: 'committed',
      }),
    );
    expect(marker.committedAt).toEqual(now);
    expect(markers.createArguments[0].leaseExpiresAt).toEqual(
      new Date(now.getTime() + 30_000),
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
    expect(markers.findOneFilters).toEqual([
      { tokenHash: service.hashRefreshToken(created.refreshToken) },
    ]);
  });

  it.each([
    ['null', null],
    ['a primitive', 'storage-failure'],
    ['an empty object', {}],
    ['a nonduplicate code', { code: 1 }],
  ])('does not classify %s as a duplicate-key race', async (_case, failure) => {
    const created = await createFamily(`nonduplicate-${_case}`);
    const family = families.documents[0];
    const originalHash = family.currentTokenHash;
    markers.nextCreate = async () => {
      throw failure;
    };

    await expect(service.rotate(created.refreshToken)).rejects.toEqual(
      new UnauthorizedException('Invalid refresh session'),
    );

    expect(markers.findOneFilters).toEqual([{ tokenHash: originalHash }]);
    expect(family.currentTokenHash).toBe(originalHash);
    expect(family.status).toBe(RefreshTokenFamilyStatus.Active);
  });

  it('denies a lost duplicate-marker race without mutating the family', async () => {
    const created = await createFamily();
    const family = families.documents[0];
    const originalHash = family.currentTokenHash;
    const insertStarted = deferred<void>();
    Object.assign(markers, {
      nextCreate: async () => {
        insertStarted.resolve(undefined);
        Object.assign(markers, { nextFindOne: () => undefined });
        throw Object.assign(new Error('duplicate'), { code: 11000 });
      },
    });

    const rotation = service.rotate(created.refreshToken);
    const insertionStartedBeforeCompletion = await Promise.race([
      insertStarted.promise.then(() => true),
      rotation.then(
        () => false,
        () => false,
      ),
    ]);

    expect(insertionStartedBeforeCompletion).toBe(true);
    await expect(rotation).rejects.toEqual(
      new UnauthorizedException('Invalid refresh session'),
    );
    expect(family.currentTokenHash).toBe(originalHash);
    expect(family.status).toBe(RefreshTokenFamilyStatus.Active);
    expect(family).not.toHaveProperty('lastRotationOperationId');
    expect(markers.findOneFilters).toEqual([
      { tokenHash: originalHash },
      { tokenHash: originalHash },
    ]);
  });

  it('handles a duplicate-marker race through the persisted committed marker', async () => {
    const created = await createFamily('duplicate-existing-marker');
    const family = families.documents[0];
    const originalHash = family.currentTokenHash;
    markers.nextCreate = async (document) => {
      markers.documents.push({ ...document, status: 'committed' });
      throw Object.assign(new Error('duplicate'), { code: 11000 });
    };

    await expect(service.rotate(created.refreshToken)).rejects.toEqual(
      new UnauthorizedException('Invalid refresh session'),
    );

    expect(markers.findOneFilters).toEqual([
      { tokenHash: originalHash },
      { tokenHash: originalHash },
    ]);
    expect(family.status).toBe(RefreshTokenFamilyStatus.Replayed);
    expect(family.revokedReason).toBe('refresh-token-replay');
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
    expect(markers.findOneAndUpdateArguments).toEqual([]);
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
    expect(markers.findOneAndUpdateArguments[0]).toEqual([
      {
        tokenHash: service.hashRefreshToken(created.refreshToken),
        status: 'pending',
        rotationOperationId: 'expired-owner',
        leaseExpiresAt: { $lte: expect.any(Date) },
      },
      {
        $set: {
          rotationOperationId: expect.any(String),
          leaseExpiresAt: expect.any(Date),
        },
      },
      { returnDocument: 'after' },
    ]);
    expect(family.lastRotationOperationId).toBe(
      markers.documents[0].rotationOperationId,
    );
  });

  it('does not take over a pending marker when the family expires exactly now', async () => {
    const now = new Date('2026-07-15T00:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    const created = await createFamily('expiry-boundary');
    const family = families.documents[0];
    family.expiresAt = now;
    const marker = createReplayMarker({
      tokenHash: service.hashRefreshToken(created.refreshToken),
      familyId: family.familyId,
      rotationOperationId: 'expiry-boundary-owner',
      leaseExpiresAt: new Date(now.getTime() - 1),
      expiresAt: now,
    });
    markers.documents.push(marker);

    await expect(service.rotate(created.refreshToken)).rejects.toEqual(
      new UnauthorizedException('Invalid refresh session'),
    );

    expect(markers.findOneAndUpdateArguments).toEqual([
      [
        {
          tokenHash: marker.tokenHash,
          status: 'pending',
          rotationOperationId: 'expiry-boundary-owner',
        },
        {
          $set: { status: 'committed', committedAt: now },
          $unset: { leaseExpiresAt: 1 },
        },
        { returnDocument: 'after' },
      ],
    ]);
    expect(marker.status).toBe('committed');
    expect(family.status).toBe(RefreshTokenFamilyStatus.Revoked);
    expect(family.revokedReason).toBe('refresh-rotation-invariant');
  });

  it('takes over a pending marker whose lease expires exactly now', async () => {
    const now = new Date('2026-07-15T00:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    const created = await createFamily('lease-boundary');
    const family = families.documents[0];
    const marker = createReplayMarker({
      tokenHash: service.hashRefreshToken(created.refreshToken),
      familyId: family.familyId,
      rotationOperationId: 'lease-boundary-owner',
      leaseExpiresAt: now,
      expiresAt: family.expiresAt,
    });
    markers.documents.push(marker);

    await expect(service.rotate(created.refreshToken)).resolves.toEqual(
      expect.objectContaining({ familyId: family.familyId }),
    );

    expect(marker.status).toBe('committed');
    expect(marker.rotationOperationId).not.toBe('lease-boundary-owner');
    expect(family.lastRotationOperationId).toBe(marker.rotationOperationId);
    expect(markers.findOneAndUpdateArguments[0]).toEqual([
      {
        tokenHash: marker.tokenHash,
        status: 'pending',
        rotationOperationId: 'lease-boundary-owner',
        leaseExpiresAt: { $lte: now },
      },
      {
        $set: {
          rotationOperationId: expect.any(String),
          leaseExpiresAt: new Date(now.getTime() + 30_000),
        },
      },
      { returnDocument: 'after' },
    ]);
  });

  it('finalizes and revokes a pending marker whose lease is missing', async () => {
    const created = await createFamily();
    const family = families.documents[0];
    const marker = {
      ...createReplayMarker({
        tokenHash: family.currentTokenHash,
        familyId: family.familyId,
        rotationOperationId: 'missing-lease-owner',
        leaseExpiresAt: undefined,
        expiresAt: family.expiresAt,
      }),
    };
    markers.documents.push(marker);

    await expect(service.rotate(created.refreshToken)).rejects.toEqual(
      new UnauthorizedException('Invalid refresh session'),
    );
    expect(marker.status).toBe('committed');
    expect(marker).not.toHaveProperty('leaseExpiresAt');
    expect(family.status).toBe(RefreshTokenFamilyStatus.Revoked);
    expect(family.revokedReason).toBe('refresh-rotation-invariant');
  });

  it('finalizes a pending marker whose family no longer exists', async () => {
    const refreshToken = 'missing-family-refresh-token';
    const marker = createReplayMarker({
      tokenHash: service.hashRefreshToken(refreshToken),
      familyId: 'missing-family',
      rotationOperationId: 'missing-family-operation',
      leaseExpiresAt: new Date(0),
    });
    markers.documents.push(marker);

    await expect(service.rotate(refreshToken)).rejects.toEqual(
      new UnauthorizedException('Invalid refresh session'),
    );

    expect(marker.status).toBe('committed');
    expect(marker).not.toHaveProperty('leaseExpiresAt');
  });

  it('denies a lost expired-marker takeover without creating a successor', async () => {
    const created = await createFamily();
    const family = families.documents[0];
    const originalHash = family.currentTokenHash;
    const marker = {
      ...createReplayMarker({
        tokenHash: originalHash,
        familyId: family.familyId,
        rotationOperationId: 'expired-owner',
        leaseExpiresAt: new Date(0),
        expiresAt: family.expiresAt,
      }),
    };
    markers.documents.push(marker);
    Object.assign(markers, { returnNullNextTakeover: true });

    await expect(service.rotate(created.refreshToken)).rejects.toEqual(
      new UnauthorizedException('Invalid refresh session'),
    );
    expect(family.currentTokenHash).toBe(originalHash);
    expect(family.status).toBe(RefreshTokenFamilyStatus.Active);
    expect(family).not.toHaveProperty('lastRotationOperationId');
    expect(marker.status).toBe('pending');
  });

  it('finalizes a pending marker whose family hash no longer matches', async () => {
    const created = await createFamily('hash-mismatch');
    const family = families.documents[0];
    const originalHash = family.currentTokenHash;
    family.currentTokenHash = 'different-current-hash';
    const marker = createReplayMarker({
      tokenHash: originalHash,
      familyId: family.familyId,
      rotationOperationId: 'hash-mismatch-owner',
      leaseExpiresAt: new Date(0),
      expiresAt: family.expiresAt,
    });
    markers.documents.push(marker);

    await expect(service.rotate(created.refreshToken)).rejects.toEqual(
      new UnauthorizedException('Invalid refresh session'),
    );

    expect(marker.status).toBe('committed');
    expect(markers.findOneAndUpdateArguments[0]?.[0]).toEqual({
      tokenHash: originalHash,
      status: 'pending',
      rotationOperationId: 'hash-mismatch-owner',
    });
    expect(family.status).toBe(RefreshTokenFamilyStatus.Revoked);
    expect(family.revokedReason).toBe('refresh-rotation-invariant');
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
    expect(
      families.updateManyArguments[families.updateManyArguments.length - 1],
    ).toEqual([
      {
        familyId: created.familyId,
        status: RefreshTokenFamilyStatus.Active,
      },
      {
        $set: {
          status: RefreshTokenFamilyStatus.Replayed,
          revokedAt: expect.any(Date),
          revokedReason: 'refresh-token-replay',
        },
        $unset: { currentTokenHash: 1 },
      },
    ]);
  });

  it('finalizes an operation-correlated pending marker against its exact family', async () => {
    await createFamily('unrelated-family');
    const created = await createFamily('correlated-family');
    const family = families.documents[1];
    const originalHash = family.currentTokenHash;
    family.currentTokenHash = 'installed-successor-hash';
    family.lastRotationOperationId = 'correlated-operation';
    markers.documents.push(
      createReplayMarker({
        tokenHash: originalHash,
        familyId: family.familyId,
        rotationOperationId: 'correlated-operation',
        leaseExpiresAt: new Date(0),
        expiresAt: family.expiresAt,
      }),
    );

    await expect(service.rotate(created.refreshToken)).rejects.toEqual(
      new UnauthorizedException('Invalid refresh session'),
    );

    expect(families.findOneFilters).toContainEqual({
      familyId: family.familyId,
    });
    expect(family.status).toBe(RefreshTokenFamilyStatus.Revoked);
    expect(family.revokedReason).toBe('refresh-rotation-orphaned');
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

  it('leaves an uncertain family CAS pending and takeover-eligible', async () => {
    const created = await createFamily();
    const originalHash = families.documents[0].currentTokenHash;
    families.failNextCas = true;

    await expect(service.rotate(created.refreshToken)).rejects.toEqual(
      new UnauthorizedException('Invalid refresh session'),
    );
    expect(families.documents[0].status).toBe(RefreshTokenFamilyStatus.Active);
    expect(families.documents[0].currentTokenHash).toBe(originalHash);
    expect(markers.documents[0].status).toBe('pending');

    markers.documents[0].leaseExpiresAt = new Date(0);
    await expect(service.rotate(created.refreshToken)).resolves.toEqual(
      expect.objectContaining({ familyId: families.documents[0].familyId }),
    );
  });

  it('finalizes an uncertain family CAS that installed a successor', async () => {
    const created = await createFamily();
    const family = families.documents[0];
    Object.assign(families, { failNextCasAfterUpdate: true });

    await expect(service.rotate(created.refreshToken)).rejects.toEqual(
      new UnauthorizedException('Invalid refresh session'),
    );
    expect(family.status).toBe(RefreshTokenFamilyStatus.Revoked);
    expect(family.revokedReason).toBe('refresh-rotation-orphaned');
    expect(markers.documents[0].status).toBe('committed');
    expect(markers.documents[0]).not.toHaveProperty('leaseExpiresAt');
    expect(families.findOneFilters).toContainEqual({
      familyId: family.familyId,
    });
  });

  it.each([
    [
      'missing',
      (document: Record<string, any> | undefined, model: FakeModel) => {
        if (document)
          model.documents.splice(model.documents.indexOf(document), 1);
      },
    ],
    [
      'revoked',
      (document: Record<string, any> | undefined) => {
        if (document) document.status = RefreshTokenFamilyStatus.Revoked;
      },
    ],
    [
      'hash-mismatched',
      (document: Record<string, any> | undefined) => {
        if (document) document.currentTokenHash = 'uncertain-other-hash';
      },
    ],
    [
      'expired',
      (document: Record<string, any> | undefined) => {
        if (document) document.expiresAt = new Date('2026-07-15T00:00:00.000Z');
      },
    ],
  ])(
    'finalizes an interrupted CAS when the recovered family is %s',
    async (_case, mutateFamily) => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-15T00:00:00.000Z'));
      const created = await createFamily(`interrupted-${_case}`);
      const family = families.documents[0];
      families.failNextCas = true;
      families.onNextCasFailure = (document) =>
        mutateFamily(document, families);

      await expect(service.rotate(created.refreshToken)).rejects.toEqual(
        new UnauthorizedException('Invalid refresh session'),
      );

      expect(markers.documents[0].status).toBe('committed');
      expect(markers.documents[0]).not.toHaveProperty('leaseExpiresAt');
      if (_case === 'hash-mismatched' || _case === 'expired') {
        expect(family.status).toBe(RefreshTokenFamilyStatus.Revoked);
        expect(family.revokedReason).toBe('refresh-rotation-invariant');
      }
    },
  );

  it('fails closed when the family compare-and-swap returns no successor', async () => {
    const created = await createFamily();
    families.returnNullNextCas = true;

    await expect(service.rotate(created.refreshToken)).rejects.toEqual(
      new UnauthorizedException('Invalid refresh session'),
    );

    expect(families.documents[0]).toEqual(
      expect.objectContaining({
        status: RefreshTokenFamilyStatus.Revoked,
        revokedReason: 'refresh-rotation-invariant',
      }),
    );
    expect(markers.documents[0].status).toBe('committed');
  });

  it('fails closed when a completed rotation marker cannot be found', async () => {
    const created = await createFamily();
    markers.returnNullNextCommit = true;

    await expect(service.rotate(created.refreshToken)).rejects.toEqual(
      new UnauthorizedException('Invalid refresh session'),
    );

    expect(families.documents[0]).toEqual(
      expect.objectContaining({
        status: RefreshTokenFamilyStatus.Revoked,
        revokedReason: 'refresh-rotation-orphaned',
      }),
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
    expect(markers.lastFindFilter).toEqual({
      status: 'pending',
      leaseExpiresAt: { $lte: expect.any(Date) },
    });
    expect(markers.lastSort).toEqual({ leaseExpiresAt: 1 });
    expect(markers.lastLimit).toBe(100);
    expect(markers.documents[0].status).toBe('committed');
    expect(orphanedFamily.status).toBe(RefreshTokenFamilyStatus.Revoked);
    expect(orphanedFamily.revokedReason).toBe('refresh-rotation-orphaned');
    expect(markers.documents[1].status).toBe('pending');
    expect(availableFamily.status).toBe(RefreshTokenFamilyStatus.Active);
  });

  it('revokes an expired family with the invariant reason during marker reconciliation', async () => {
    const now = new Date('2026-07-15T00:00:00.000Z');
    const created = await createFamily('expired-reconciliation');
    const family = families.documents[0];
    family.expiresAt = now;
    const marker = createReplayMarker({
      tokenHash: service.hashRefreshToken(created.refreshToken),
      familyId: family.familyId,
      rotationOperationId: 'expired-family-operation',
      leaseExpiresAt: new Date(now.getTime() - 1),
      expiresAt: family.expiresAt,
    });
    markers.documents.push(marker);

    await expect(service.reconcileExpiredPendingMarkers(now)).resolves.toBe(1);

    expect(marker.status).toBe('committed');
    expect(marker).not.toHaveProperty('leaseExpiresAt');
    expect(family).toEqual(
      expect.objectContaining({
        status: RefreshTokenFamilyStatus.Revoked,
        revokedReason: 'refresh-rotation-invariant',
      }),
    );
  });

  it('finalizes a pending marker for a family that is no longer active', async () => {
    const now = new Date('2026-07-15T00:00:00.000Z');
    const created = await createFamily('revoked-reconciliation');
    const family = families.documents[0];
    family.status = RefreshTokenFamilyStatus.Revoked;
    const marker = createReplayMarker({
      tokenHash: service.hashRefreshToken(created.refreshToken),
      familyId: family.familyId,
      rotationOperationId: 'revoked-family-operation',
      leaseExpiresAt: new Date(now.getTime() - 1),
      expiresAt: family.expiresAt,
    });
    markers.documents.push(marker);

    await expect(service.reconcileExpiredPendingMarkers(now)).resolves.toBe(1);

    expect(marker.status).toBe('committed');
    expect(marker).not.toHaveProperty('leaseExpiresAt');
  });

  it('finalizes a reconciled pending marker whose family is missing', async () => {
    const now = new Date('2026-07-15T00:00:00.000Z');
    const marker = createReplayMarker({
      tokenHash: service.hashRefreshToken('missing-reconciliation-family'),
      familyId: 'missing-reconciliation-family',
      rotationOperationId: 'missing-reconciliation-operation',
      leaseExpiresAt: new Date(now.getTime() - 1),
    });
    markers.documents.push(marker);

    await expect(service.reconcileExpiredPendingMarkers(now)).resolves.toBe(1);

    expect(marker.status).toBe('committed');
    expect(marker).not.toHaveProperty('leaseExpiresAt');
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

  it('contains scheduled reconciliation failures and leaves the next interval available', async () => {
    jest.useFakeTimers();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const reconcile = jest
      .spyOn(service, 'reconcileExpiredPendingMarkers')
      .mockRejectedValueOnce(new Error('query failed'))
      .mockResolvedValueOnce(0);

    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(60_000);
    await jest.advanceTimersByTimeAsync(60_000);

    expect(reconcile).toHaveBeenCalledTimes(2);
  });

  it('contains individual reconciliation query failures', async () => {
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const created = await createFamily('reconciliation-failure');
    const family = families.documents[0];
    markers.documents.push({
      tokenHash: service.hashRefreshToken(created.refreshToken),
      familyId: family.familyId,
      status: 'pending',
      rotationOperationId: 'failed-query',
      leaseExpiresAt: new Date(Date.now() - 1),
      expiresAt: family.expiresAt,
    });
    families.failNextFindOne = true;

    await expect(service.reconcileExpiredPendingMarkers()).resolves.toBe(0);
    expect(family.status).toBe(RefreshTokenFamilyStatus.Active);
    expect(logError).toHaveBeenCalledWith(
      'Refresh rotation marker reconciliation failed',
    );
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

  it('clamps expired cookies at zero and changes only Secure outside production', () => {
    const now = new Date('2026-07-15T00:00:00Z');
    const development = service.getRefreshCookieOptions(
      new Date(now.getTime() - 1),
      false,
      now,
    );
    const production = service.getRefreshCookieOptions(600, true, now);

    expect(development).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/auth',
      maxAge: 0,
    });
    expect(production).toEqual({
      ...development,
      secure: true,
      maxAge: 600_000,
    });
    expect(service.getClearRefreshCookieOptions(false)).toEqual({
      ...development,
      maxAge: 0,
    });
  });

  it('resolves only a family id for active and replayed refresh credentials', async () => {
    const created = await createFamily('resolvable-subject');
    const rotated = await service.rotate(created.refreshToken);

    expect(await service.resolveFamilyId(rotated.refreshToken)).toBe(
      created.familyId,
    );
    expect(await service.resolveFamilyId(created.refreshToken)).toBe(
      created.familyId,
    );
    expect(await service.resolveFamilyId(undefined)).toBeUndefined();
    expect(families.selectedProjections).toEqual([
      { _id: 0, familyId: 1 },
      { _id: 0, familyId: 1 },
    ]);
    expect(markers.selectedProjections).toEqual([{ _id: 0, familyId: 1 }]);
  });

  it('does not resolve an unknown refresh credential through an unrelated replay marker', async () => {
    markers.documents.push(
      createReplayMarker({
        tokenHash: service.hashRefreshToken('another-refresh-token'),
        familyId: 'another-family',
      }),
    );

    await expect(
      service.resolveFamilyId('unknown-refresh-token'),
    ).resolves.toBeUndefined();
  });

  it('rejects an unknown refresh credential with the public denial contract', async () => {
    await expect(service.rotate('unknown-refresh-token')).rejects.toEqual(
      new UnauthorizedException('Invalid refresh session'),
    );

    expect(markers.documents).toEqual([]);
    expect(families.documents).toEqual([]);
  });

  it('denies marker preparation when no active unexpired family exists', async () => {
    const tokenHash = service.hashRefreshToken('unowned-refresh-token');

    const denial = await (service as any)
      .prepareRotation(tokenHash, new Date('2026-07-15T00:00:00.000Z'))
      .then(
        () => undefined,
        (error: unknown) => error,
      );

    expect(denial).toBeInstanceOf(UnauthorizedException);
    expect((denial as UnauthorizedException).message).toBe(
      'Invalid refresh session',
    );
    expect((denial as UnauthorizedException).getStatus()).toBe(401);
    expect(markers.createArguments).toEqual([]);
  });

  it('denies a missing family before consuming a rotation operation id', async () => {
    const firstFamilyId = '00000000-0000-4000-8000-000000000001';
    const secondFamilyId = '00000000-0000-4000-8000-000000000002';
    jest
      .spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce(firstFamilyId)
      .mockReturnValueOnce(secondFamilyId);

    await expect(
      (service as any).prepareRotation(
        service.hashRefreshToken('unowned-refresh-token'),
        new Date('2026-07-15T00:00:00.000Z'),
      ),
    ).rejects.toEqual(new UnauthorizedException('Invalid refresh session'));

    await expect(createFamily('uuid-sequence')).resolves.toMatchObject({
      familyId: firstFamilyId,
    });
  });

  it('rejects malformed, missing, expired, and revoked credentials without mutation', async () => {
    const expired = await createFamily('expired-subject');
    const revoked = await createFamily('revoked-subject');
    families.documents[0].expiresAt = new Date(Date.now() - 1);
    families.documents[1].status = RefreshTokenFamilyStatus.Revoked;
    const beforeMarkers = markers.documents.length;

    for (const refreshToken of [
      undefined,
      '',
      'missing-refresh-token',
      expired.refreshToken,
      revoked.refreshToken,
    ]) {
      await expect(service.rotate(refreshToken as never)).rejects.toEqual(
        new UnauthorizedException('Invalid refresh session'),
      );
    }

    expect(markers.documents).toHaveLength(beforeMarkers);
    expect(families.documents[0].status).toBe(RefreshTokenFamilyStatus.Active);
    expect(families.documents[1].status).toBe(RefreshTokenFamilyStatus.Revoked);
  });

  it('revokes families and subjects idempotently', async () => {
    await createFamily('idempotent-subject');
    await createFamily('idempotent-subject');

    await service.revokeFamily(
      families.documents[0].familyId,
      'inactive-subject',
    );
    await service.revokeFamily(
      families.documents[0].familyId,
      'inactive-subject',
    );
    await service.revokeSubject(
      AuthSubjectType.Staff,
      'idempotent-subject',
      'stale-auth-version',
    );
    await service.revokeSubject(
      AuthSubjectType.Staff,
      'idempotent-subject',
      'stale-auth-version',
    );
    await expect(
      service.revokeRefreshToken(undefined, 'missing-cookie'),
    ).resolves.toBeUndefined();

    expect(families.documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: RefreshTokenFamilyStatus.Revoked,
          revokedReason: 'inactive-subject',
        }),
        expect.objectContaining({
          status: RefreshTokenFamilyStatus.Revoked,
          revokedReason: 'stale-auth-version',
        }),
      ]),
    );
    expect(families.documents).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ currentTokenHash: expect.any(String) }),
      ]),
    );
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
