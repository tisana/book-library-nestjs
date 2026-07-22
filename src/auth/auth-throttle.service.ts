import { createHmac } from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthIdentifierRepairKeyPolicyService } from './auth-identifier-repair-key-policy.service';
import {
  AuthThrottleBucketDocument,
  AuthThrottleBucketModelName,
  AuthThrottleDimension,
} from './schemas/auth-throttle-bucket.schema';

export { AuthThrottleDimension } from './schemas/auth-throttle-bucket.schema';

export type GenericSignInFailureCategory =
  | 'unknown'
  | 'ambiguous'
  | 'invalid-password'
  | 'inactive'
  | 'suspended'
  | 'locked'
  | 'missing-credential';

export type AuthThrottleDenialReason =
  | 'throttle-limit-exceeded'
  | 'throttle-key-required';

export interface AuthThrottleDecision {
  allowed: boolean;
  reason?: AuthThrottleDenialReason;
  retryAfterSeconds?: number;
}

export interface SignInThrottleInput {
  sourceIdentity: string;
  normalizedIdentifier?: string;
  failureCategory?: GenericSignInFailureCategory;
}

export interface RefreshThrottleInput {
  sourceIdentity: string;
  familyId?: string;
}

interface VersionedSecret {
  version: number;
  secret: Buffer;
}

interface ThrottlePolicy {
  limit: number;
  windowSeconds: number;
}

interface ConsumeDimensionInput extends ThrottlePolicy {
  dimension: AuthThrottleDimension;
  value: string;
}

const GENERIC_FAILURE_CATEGORIES = new Set<GenericSignInFailureCategory>([
  'unknown',
  'ambiguous',
  'invalid-password',
  'inactive',
  'suspended',
  'locked',
  'missing-credential',
]);

@Injectable()
export class AuthThrottleService {
  constructor(
    @InjectModel(AuthThrottleBucketModelName)
    private readonly bucketModel: Model<AuthThrottleBucketDocument>,
    @Optional() private readonly configService?: ConfigService,
    @Optional()
    private readonly keyPolicyService?: AuthIdentifierRepairKeyPolicyService,
  ) {}

  async consumeSignInAttempt(
    input: SignInThrottleInput,
    now = new Date(),
  ): Promise<AuthThrottleDecision> {
    const dimensions: ConsumeDimensionInput[] = [
      {
        dimension: AuthThrottleDimension.SignInSource,
        value: input.sourceIdentity,
        ...this.policy('signInSource', 20, 900),
      },
    ];

    if (
      input.normalizedIdentifier &&
      input.failureCategory &&
      GENERIC_FAILURE_CATEGORIES.has(input.failureCategory)
    ) {
      dimensions.push({
        dimension: AuthThrottleDimension.SignInIdentifierFailure,
        value: input.normalizedIdentifier,
        ...this.policy('signInIdentifierFailure', 5, 900),
      });
    }

    return this.consumeMany(dimensions, now);
  }

  async consumeSignInIdentifierFailure(
    normalizedIdentifier: string,
    failureCategory: GenericSignInFailureCategory,
    now = new Date(),
  ): Promise<AuthThrottleDecision> {
    if (!GENERIC_FAILURE_CATEGORIES.has(failureCategory)) {
      return { allowed: true };
    }

    return this.consumeMany(
      [
        {
          dimension: AuthThrottleDimension.SignInIdentifierFailure,
          value: normalizedIdentifier,
          ...this.policy('signInIdentifierFailure', 5, 900),
        },
      ],
      now,
    );
  }

  async consumeRefreshAttempt(
    input: RefreshThrottleInput,
    now = new Date(),
  ): Promise<AuthThrottleDecision> {
    const refreshPolicy = this.policy('refresh', 30, 300);
    const dimensions: ConsumeDimensionInput[] = [
      {
        dimension: AuthThrottleDimension.RefreshSource,
        value: input.sourceIdentity,
        ...refreshPolicy,
      },
    ];

    if (input.familyId) {
      dimensions.push({
        dimension: AuthThrottleDimension.RefreshFamily,
        value: input.familyId,
        ...refreshPolicy,
      });
    }

    return this.consumeMany(dimensions, now);
  }

  private async consumeMany(
    dimensions: ConsumeDimensionInput[],
    now: Date,
  ): Promise<AuthThrottleDecision> {
    const keyring = this.loadKeyring();

    if (!keyring.length || !(await this.hasEveryReferencedKey(keyring, now))) {
      return { allowed: false, reason: 'throttle-key-required' };
    }

    const decisions = await Promise.all(
      dimensions.map((dimension) =>
        this.consumeDimension(dimension, keyring, now),
      ),
    );
    const denied = decisions.filter((decision) => !decision.allowed);

    if (!denied.length) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: 'throttle-limit-exceeded',
      retryAfterSeconds: Math.max(
        ...denied.map((decision) => decision.retryAfterSeconds ?? 1),
      ),
    };
  }

  private async consumeDimension(
    input: ConsumeDimensionInput,
    keyring: VersionedSecret[],
    now: Date,
  ): Promise<AuthThrottleDecision> {
    const candidates = keyring.map(({ version, secret }) => ({
      keyVersion: version,
      bucketKey: this.deriveBucketKey(secret, input.dimension, input.value),
    }));
    const existing = await this.bucketModel
      .findOneAndUpdate(
        {
          dimension: input.dimension,
          expiresAt: { $gt: now },
          $or: candidates,
        },
        { $inc: { count: 1 }, $set: { updatedAt: now } },
        { returnDocument: 'after', sort: { keyVersion: -1 } },
      )
      .lean()
      .exec();

    if (existing) {
      return this.toDecision(existing, input.limit, now);
    }

    const current = candidates[0];
    const expiresAt = new Date(now.getTime() + input.windowSeconds * 1000);
    let bucket: AuthThrottleBucketDocument | null;

    try {
      bucket = await this.bucketModel
        .findOneAndUpdate(
          {
            dimension: input.dimension,
            keyVersion: current.keyVersion,
            bucketKey: current.bucketKey,
          },
          [
            {
              $set: {
                dimension: input.dimension,
                keyVersion: current.keyVersion,
                bucketKey: current.bucketKey,
                count: {
                  $cond: [
                    { $gt: ['$expiresAt', now] },
                    { $add: [{ $ifNull: ['$count', 0] }, 1] },
                    1,
                  ],
                },
                windowStartedAt: {
                  $cond: [
                    { $gt: ['$expiresAt', now] },
                    '$windowStartedAt',
                    now,
                  ],
                },
                expiresAt: {
                  $cond: [
                    { $gt: ['$expiresAt', now] },
                    '$expiresAt',
                    expiresAt,
                  ],
                },
                createdAt: { $ifNull: ['$createdAt', now] },
                updatedAt: now,
              },
            },
          ],
          { returnDocument: 'after', updatePipeline: true, upsert: true },
        )
        .lean()
        .exec();
    } catch (error) {
      if (!this.isDuplicateKeyError(error)) {
        throw error;
      }

      bucket = await this.bucketModel
        .findOneAndUpdate(
          {
            dimension: input.dimension,
            keyVersion: current.keyVersion,
            bucketKey: current.bucketKey,
            expiresAt: { $gt: now },
          },
          { $inc: { count: 1 }, $set: { updatedAt: now } },
          { returnDocument: 'after' },
        )
        .lean()
        .exec();
    }

    if (!bucket) {
      return { allowed: false, reason: 'throttle-limit-exceeded' };
    }

    return this.toDecision(bucket, input.limit, now);
  }

  private async hasEveryReferencedKey(
    keyring: VersionedSecret[],
    now: Date,
  ): Promise<boolean> {
    if (this.keyPolicyService) {
      const required = await this.keyPolicyService.getRequiredKeyVersions(now);
      const configuredVersions = new Set(
        keyring.map(({ version }) => version),
      );

      return required.throttleVersions.every((version) =>
        configuredVersions.has(version),
      );
    }

    const query = this.bucketModel.distinct('keyVersion', {
      expiresAt: { $gt: now },
    });
    const versions = await ('exec' in query ? query.exec() : query);
    const configuredVersions = new Set(keyring.map(({ version }) => version));

    return (versions as number[]).every((version) =>
      configuredVersions.has(Number(version)),
    );
  }

  private toDecision(
    bucket: AuthThrottleBucketDocument,
    limit: number,
    now: Date,
  ): AuthThrottleDecision {
    if (bucket.count <= limit) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: 'throttle-limit-exceeded',
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((new Date(bucket.expiresAt).getTime() - now.getTime()) / 1000),
      ),
    };
  }

  private deriveBucketKey(
    secret: Buffer,
    dimension: AuthThrottleDimension,
    value: string,
  ): string {
    return createHmac('sha256', secret)
      .update('book-library/auth-throttle/v1\0', 'utf8')
      .update(dimension, 'utf8')
      .update('\0', 'utf8')
      .update(value, 'utf8')
      .digest('base64url');
  }

  private loadKeyring(): VersionedSecret[] {
    const currentVersion = this.positiveInteger(
      this.config('auth.auditCorrelationKeyVersion') ??
        process.env.AUTH_AUDIT_CORRELATION_KEY_VERSION,
    );
    const currentSecret = this.decodeSecret(
      this.config('auth.auditCorrelationSecret') ??
        process.env.AUTH_AUDIT_CORRELATION_SECRET,
    );

    if (!currentVersion || !currentSecret) {
      return [];
    }

    const previousRaw =
      this.config('auth.auditCorrelationPreviousKeys') ??
      process.env.AUTH_AUDIT_CORRELATION_PREVIOUS_KEYS ??
      {};
    const previous = this.parsePreviousKeys(previousRaw);

    if (!previous) {
      return [];
    }

    return [
      { version: currentVersion, secret: currentSecret },
      ...Object.entries(previous)
        .map(([version, secret]) => ({
          version: this.positiveInteger(version),
          secret: this.decodeSecret(secret),
        }))
        .filter(
          (entry): entry is VersionedSecret =>
            Boolean(entry.version && entry.secret) &&
            entry.version !== currentVersion,
        )
        .sort((left, right) => right.version - left.version),
    ];
  }

  private parsePreviousKeys(value: unknown): Record<string, unknown> | undefined {
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        return undefined;
      }
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    return value as Record<string, unknown>;
  }

  private decodeSecret(value: unknown): Buffer | undefined {
    if (Buffer.isBuffer(value)) {
      return value.length >= 32 ? value : undefined;
    }

    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
      return undefined;
    }

    const decoded = Buffer.from(value, 'base64url');
    return decoded.length >= 32 ? decoded : undefined;
  }

  private positiveInteger(value: unknown): number | undefined {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  }

  private policy(
    name: 'signInIdentifierFailure' | 'signInSource' | 'refresh',
    defaultLimit: number,
    defaultWindowSeconds: number,
  ): ThrottlePolicy {
    const flatPaths = {
      signInIdentifierFailure: {
        limit: 'auth.signInIdentifierFailureLimit',
        windowSeconds: 'auth.signInWindowSeconds',
      },
      signInSource: {
        limit: 'auth.signInSourceLimit',
        windowSeconds: 'auth.signInWindowSeconds',
      },
      refresh: {
        limit: 'auth.refreshThrottleLimit',
        windowSeconds: 'auth.refreshThrottleWindowSeconds',
      },
    } as const;

    return {
      limit:
        this.positiveInteger(this.config(flatPaths[name].limit)) ??
        this.positiveInteger(this.config(`auth.throttle.${name}.limit`)) ??
        defaultLimit,
      windowSeconds:
        this.positiveInteger(this.config(flatPaths[name].windowSeconds)) ??
        this.positiveInteger(
          this.config(`auth.throttle.${name}.windowSeconds`),
        ) ??
        defaultWindowSeconds,
    };
  }

  private config(path: string): unknown {
    return this.configService?.get<unknown>(path);
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return Boolean(
      error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: number }).code === 11000,
    );
  }
}
