import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthIdentifierOperationModelName } from './schemas/auth-identifier-operation.schema';
import { AuthThrottleBucketModelName } from './schemas/auth-throttle-bucket.schema';

export const REPAIR_KEY_POLICY_INDEX = {
  operationType: 1,
  status: 1,
  cleanupStatus: 1,
  manifestKeyVersion: 1,
} as const;

export const THROTTLE_KEY_POLICY_INDEX = {
  keyVersion: 1,
  expiresAt: 1,
} as const;

const INCOMPLETE_REPAIR_STATUSES = [
  'pending',
  'applying',
  'compensating',
  'finalizing',
  'failed-retryable',
] as const;

const MAX_PREVIOUS_KEYS = 2;

interface RepairOperationKeyProjection {
  manifestKeyVersion?: number;
}

interface ThrottleBucketKeyProjection {
  keyVersion?: number;
}

type KeyPolicyModel = Model<Record<string, unknown>>;

export type AuthKeyPolicyReason =
  | 'ready'
  | 'repair-key-required'
  | 'throttle-key-required';

export interface AuthKeyPolicyDecision {
  allowed: boolean;
  reason: AuthKeyPolicyReason;
  requiredVersion?: number;
}

export interface AuthKeyPolicyReadiness {
  ready: boolean;
  reason: AuthKeyPolicyReason;
  requiredVersions: number[];
  requiredVersionCount: number;
  missingVersions: number[];
}

export interface RequiredAuditKeyVersions {
  repairVersions: number[];
  throttleVersions: number[];
  requiredVersions: number[];
}

export interface AuditKeyRotationPreflightInput {
  candidateCurrentVersion: number;
  candidatePreviousVersions: number[];
}

export type AuditKeyRotationPreflightResult = {
  requiredPreviousVersions: number[];
  requiredPreviousCount: number;
  maxPreviousKeys: number;
} & (
  | { status: 'ok' }
  | { status: 'blocked'; reason: 'repair-key-rotation-blocked' }
);

@Injectable()
export class AuthIdentifierRepairKeyPolicyService {
  constructor(
    @InjectModel(AuthIdentifierOperationModelName)
    private readonly operationModel: KeyPolicyModel,
    @InjectModel(AuthThrottleBucketModelName)
    private readonly throttleBucketModel: KeyPolicyModel,
    private readonly configService: ConfigService,
  ) {}

  async getRequiredKeyVersions(
    now = new Date(),
  ): Promise<RequiredAuditKeyVersions> {
    const [repairRows, throttleRows] = await Promise.all([
      this.operationModel
        .find({
          operationType: 'offline-repair',
          manifestKeyVersion: { $exists: true },
          $or: [
            { status: { $in: INCOMPLETE_REPAIR_STATUSES } },
            { cleanupStatus: 'pending' },
          ],
        })
        .select({ _id: 0, manifestKeyVersion: 1 })
        .hint(REPAIR_KEY_POLICY_INDEX)
        .lean()
        .exec() as Promise<RepairOperationKeyProjection[]>,
      this.throttleBucketModel
        .find({
          keyVersion: { $exists: true },
          expiresAt: { $gt: now },
        })
        .select({ _id: 0, keyVersion: 1 })
        .hint(THROTTLE_KEY_POLICY_INDEX)
        .lean()
        .exec() as Promise<ThrottleBucketKeyProjection[]>,
    ]);

    const repairVersions = this.sortedVersions(
      repairRows.map((row) => row.manifestKeyVersion),
    );
    const throttleVersions = this.sortedVersions(
      throttleRows.map((row) => row.keyVersion),
    );

    return {
      repairVersions,
      throttleVersions,
      requiredVersions: this.sortedVersions([
        ...repairVersions,
        ...throttleVersions,
      ]),
    };
  }

  async evaluateReadiness(now = new Date()): Promise<AuthKeyPolicyReadiness> {
    const required = await this.getRequiredKeyVersions(now);
    const configured = new Set(this.getConfiguredKeyVersions());
    const missingRepair = required.repairVersions.filter(
      (version) => !configured.has(version),
    );
    const missingThrottle = required.throttleVersions.filter(
      (version) => !configured.has(version),
    );
    const missingVersions = this.sortedVersions([
      ...missingRepair,
      ...missingThrottle,
    ]);
    const reason: AuthKeyPolicyReason = missingRepair.length
      ? 'repair-key-required'
      : missingThrottle.length
        ? 'throttle-key-required'
        : 'ready';

    return {
      ready: missingVersions.length === 0,
      reason,
      requiredVersions: required.requiredVersions,
      requiredVersionCount: required.requiredVersions.length,
      missingVersions,
    };
  }

  repairWorkerDecision(manifestKeyVersion?: number): AuthKeyPolicyDecision {
    return this.decisionForVersion(manifestKeyVersion, 'repair-key-required');
  }

  throttleRequestDecision(keyVersion?: number): AuthKeyPolicyDecision {
    return this.decisionForVersion(keyVersion, 'throttle-key-required');
  }

  async preflightRotation(
    input: AuditKeyRotationPreflightInput,
    now = new Date(),
  ): Promise<AuditKeyRotationPreflightResult> {
    const required = await this.getRequiredKeyVersions(now);
    const requiredPreviousVersions = this.sortedVersions([
      ...input.candidatePreviousVersions,
      ...required.requiredVersions.filter(
        (version) => version !== input.candidateCurrentVersion,
      ),
    ]);
    const blocked = requiredPreviousVersions.length > MAX_PREVIOUS_KEYS;

    const metadata = {
      requiredPreviousVersions,
      requiredPreviousCount: requiredPreviousVersions.length,
      maxPreviousKeys: MAX_PREVIOUS_KEYS,
    };
    return blocked
      ? {
          status: 'blocked',
          reason: 'repair-key-rotation-blocked',
          ...metadata,
        }
      : { status: 'ok', ...metadata };
  }

  getConfiguredKeyVersions(): number[] {
    return this.sortedVersions([...this.configuredKeys().keys()]);
  }

  getKeyMaterial(version: number): string | Buffer | undefined {
    return this.configuredKeys().get(version);
  }

  private decisionForVersion(
    version: number | undefined,
    deniedReason: Exclude<AuthKeyPolicyReason, 'ready'>,
  ): AuthKeyPolicyDecision {
    if (version === undefined || !this.configuredKeys().has(version)) {
      return {
        allowed: false,
        reason: deniedReason,
        requiredVersion: version,
      };
    }

    return { allowed: true, reason: 'ready', requiredVersion: version };
  }

  private configuredKeys(): Map<number, string | Buffer> {
    const keys = new Map<number, string | Buffer>();
    const keyRing = this.configService.get<{
      keysByVersion?: Record<string, string | Buffer>;
    }>('auth.auditCorrelationKeyRing');
    if (keyRing?.keysByVersion) {
      this.addConfiguredEntries(keys, keyRing.keysByVersion);
    }
    const configuredLookup =
      this.configService.get<Record<string, string | Buffer>>(
        'auth.auditCorrelationKeys',
      ) ??
      this.configService.get<Record<string, string | Buffer>>(
        'auth.auditCorrelationKeyLookup',
      );

    if (configuredLookup) {
      this.addConfiguredEntries(keys, configuredLookup);
    }

    const currentVersion = this.configService.get<number>(
      'auth.auditCorrelationKeyVersion',
    );
    const currentSecret = this.configService.get<string | Buffer>(
      'auth.auditCorrelationSecret',
    );
    if (this.isPositiveVersion(currentVersion) && currentSecret) {
      keys.set(currentVersion, currentSecret);
    }

    const previous = this.configService.get<Record<string, string | Buffer>>(
      'auth.auditCorrelationPreviousKeys',
    );
    if (previous) {
      this.addConfiguredEntries(keys, previous);
    }

    return keys;
  }

  private addConfiguredEntries(
    target: Map<number, string | Buffer>,
    source: Record<string, string | Buffer>,
  ): void {
    for (const [rawVersion, secret] of Object.entries(source)) {
      const version = Number(rawVersion);
      if (this.isPositiveVersion(version) && secret) {
        target.set(version, secret);
      }
    }
  }

  private sortedVersions(values: Array<number | undefined>): number[] {
    return [...new Set(values.filter(this.isPositiveVersion))].sort(
      (left, right) => left - right,
    );
  }

  private readonly isPositiveVersion = (
    value: number | undefined,
  ): value is number => Number.isInteger(value) && (value ?? 0) > 0;
}
