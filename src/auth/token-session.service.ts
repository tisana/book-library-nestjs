import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AuthSubjectType,
  RefreshTokenFamilyDocument,
  RefreshTokenFamilyModelName,
  RefreshTokenFamilyStatus,
} from './schemas/refresh-token-family.schema';
import {
  RefreshTokenReplayMarkerDocument,
  RefreshTokenReplayMarkerModelName,
  RefreshTokenReplayMarkerStatus,
} from './schemas/refresh-token-replay-marker.schema';

const maximumRefreshLifetimeSeconds = 2_592_000;
const rotationLeaseMs = 30_000;
const reconciliationIntervalMs = 60_000;
const reconciliationBatchSize = 100;
const genericRefreshDenial = 'Invalid refresh session';

type RefreshTokenFamilyPersistence = RefreshTokenFamilyDocument;
type RefreshTokenReplayMarkerPersistence = RefreshTokenReplayMarkerDocument;

interface PreparedRotation {
  family: RefreshTokenFamilyPersistence;
  operationId: string;
}

export interface CreateRefreshTokenFamilyInput {
  clientId: string;
  subjectType: AuthSubjectType;
  subjectId: string;
  scopes: string[];
  authVersion: number;
  ttlSeconds: number;
}

export interface RefreshTokenRotationResult {
  familyId: string;
  clientId: string;
  subjectType: AuthSubjectType;
  subjectId: string;
  scopes: string[];
  authVersion: number;
  refreshToken: string;
  expiresAt: Date;
}

export interface RefreshCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: 'strict';
  path: '/auth';
  maxAge: number;
}

@Injectable()
export class TokenSessionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TokenSessionService.name);
  private reconciliationTimer?: ReturnType<typeof setInterval>;

  constructor(
    @InjectModel(RefreshTokenFamilyModelName)
    private readonly refreshTokenFamilyModel: Model<RefreshTokenFamilyPersistence>,
    @InjectModel(RefreshTokenReplayMarkerModelName)
    private readonly replayMarkerModel: Model<RefreshTokenReplayMarkerPersistence>,
  ) {}

  onModuleInit(): void {
    this.reconciliationTimer = setInterval(() => {
      void this.reconcileExpiredPendingMarkers().catch(() => {
        this.logger.error('Refresh rotation reconciliation failed');
      });
    }, reconciliationIntervalMs);
    this.reconciliationTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.reconciliationTimer) {
      clearInterval(this.reconciliationTimer);
      this.reconciliationTimer = undefined;
    }
  }

  async createFamily(
    input: CreateRefreshTokenFamilyInput,
  ): Promise<RefreshTokenRotationResult> {
    const refreshToken = this.generateRefreshToken();
    const now = new Date();
    const ttlSeconds = Math.min(
      Math.max(1, Math.floor(input.ttlSeconds)),
      maximumRefreshLifetimeSeconds,
    );
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const familyId = randomUUID();

    await this.refreshTokenFamilyModel.create({
      familyId,
      clientId: input.clientId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      scopes: input.scopes,
      authVersion: input.authVersion,
      status: RefreshTokenFamilyStatus.Active,
      currentTokenHash: this.hashRefreshToken(refreshToken),
      issuedAt: now,
      lastRotatedAt: now,
      expiresAt,
    } as RefreshTokenFamilyPersistence);

    return {
      familyId,
      clientId: input.clientId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      scopes: input.scopes,
      authVersion: input.authVersion,
      refreshToken,
      expiresAt,
    };
  }

  async rotate(refreshToken: string): Promise<RefreshTokenRotationResult> {
    if (!refreshToken) {
      this.denyRefresh();
    }

    const tokenHash = this.hashRefreshToken(refreshToken);
    const now = new Date();
    const prepared = await this.prepareRotation(tokenHash, now);
    const nextRefreshToken = this.generateRefreshToken();
    const nextTokenHash = this.hashRefreshToken(nextRefreshToken);

    let rotatedFamily: RefreshTokenFamilyPersistence | null = null;
    try {
      rotatedFamily = await this.refreshTokenFamilyModel
        .findOneAndUpdate(
          {
            familyId: prepared.family.familyId,
            currentTokenHash: tokenHash,
            status: RefreshTokenFamilyStatus.Active,
            expiresAt: { $gt: now },
          },
          {
            $set: {
              currentTokenHash: nextTokenHash,
              lastRotatedAt: now,
              lastRotationOperationId: prepared.operationId,
            },
          },
          { new: true },
        )
        .exec();
    } catch {
      await this.recoverAfterInterruptedCas(
        prepared.family.familyId,
        tokenHash,
        prepared.operationId,
      );
      this.denyRefresh();
    }

    if (!rotatedFamily) {
      await this.finalizeAndRevoke(
        prepared.family.familyId,
        tokenHash,
        prepared.operationId,
        'refresh-rotation-invariant',
      );
      this.denyRefresh();
    }

    try {
      const committed = await this.commitMarker(
        tokenHash,
        prepared.operationId,
      );
      if (!committed) {
        await this.revokeFamily(
          prepared.family.familyId,
          'refresh-rotation-orphaned',
        );
        this.denyRefresh();
      }
    } catch {
      await this.revokeFamily(
        prepared.family.familyId,
        'refresh-rotation-orphaned',
      ).catch(() => undefined);
      this.denyRefresh();
    }

    return this.rotationResult(rotatedFamily, nextRefreshToken);
  }

  async resolveFamilyId(
    refreshToken: string | undefined,
  ): Promise<string | undefined> {
    if (!refreshToken) {
      return undefined;
    }

    const tokenHash = this.hashRefreshToken(refreshToken);
    const family = await this.refreshTokenFamilyModel
      .findOne({ currentTokenHash: tokenHash })
      .select({ _id: 0, familyId: 1 })
      .lean()
      .exec();

    if (family?.familyId) {
      return family.familyId;
    }

    const marker = await this.replayMarkerModel
      .findOne({ tokenHash })
      .select({ _id: 0, familyId: 1 })
      .lean()
      .exec();

    return marker?.familyId;
  }

  async reconcileExpiredPendingMarkers(now = new Date()): Promise<number> {
    const markers = await this.replayMarkerModel
      .find({
        status: RefreshTokenReplayMarkerStatus.Pending,
        leaseExpiresAt: { $lte: now },
      })
      .sort({ leaseExpiresAt: 1 })
      .limit(reconciliationBatchSize)
      .exec();

    let reconciled = 0;
    for (const marker of markers) {
      try {
        const family = await this.refreshTokenFamilyModel
          .findOne({ familyId: marker.familyId })
          .exec();

        if (
          family?.status === RefreshTokenFamilyStatus.Active &&
          family.currentTokenHash === marker.tokenHash &&
          family.expiresAt > now
        ) {
          continue;
        }

        const reason =
          family?.lastRotationOperationId === marker.rotationOperationId
            ? 'refresh-rotation-orphaned'
            : 'refresh-rotation-invariant';
        await this.finalizeAndRevoke(
          marker.familyId,
          marker.tokenHash,
          marker.rotationOperationId,
          reason,
        );
        reconciled += 1;
      } catch {
        this.logger.error('Refresh rotation marker reconciliation failed');
      }
    }

    return reconciled;
  }

  async revokeRefreshToken(
    refreshToken: string | undefined,
    reason: string,
  ): Promise<void> {
    if (!refreshToken) {
      return;
    }

    await this.refreshTokenFamilyModel.updateMany(
      {
        currentTokenHash: this.hashRefreshToken(refreshToken),
        status: RefreshTokenFamilyStatus.Active,
      },
      this.revocationUpdate(RefreshTokenFamilyStatus.Revoked, reason),
    );
  }

  async revokeFamily(familyId: string, reason: string): Promise<void> {
    await this.refreshTokenFamilyModel.updateMany(
      { familyId, status: RefreshTokenFamilyStatus.Active },
      this.revocationUpdate(RefreshTokenFamilyStatus.Revoked, reason),
    );
  }

  async revokeSubject(
    subjectType: AuthSubjectType,
    subjectId: string,
    reason: string,
  ): Promise<void> {
    await this.refreshTokenFamilyModel.updateMany(
      { subjectType, subjectId, status: RefreshTokenFamilyStatus.Active },
      this.revocationUpdate(RefreshTokenFamilyStatus.Revoked, reason),
    );
  }

  hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  getRefreshCookieOptions(
    expiresAtOrTtlSeconds: Date | number,
    isProduction = process.env.NODE_ENV === 'production',
    now = new Date(),
  ): RefreshCookieOptions {
    const remainingMs =
      expiresAtOrTtlSeconds instanceof Date
        ? expiresAtOrTtlSeconds.getTime() - now.getTime()
        : Math.min(
            Math.max(0, expiresAtOrTtlSeconds),
            maximumRefreshLifetimeSeconds,
          ) * 1000;

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/auth',
      maxAge: Math.max(0, Math.floor(remainingMs)),
    };
  }

  getClearRefreshCookieOptions(
    isProduction = process.env.NODE_ENV === 'production',
  ): RefreshCookieOptions {
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/auth',
      maxAge: 0,
    };
  }

  private async prepareRotation(
    tokenHash: string,
    now: Date,
  ): Promise<PreparedRotation> {
    const existingMarker = await this.replayMarkerModel
      .findOne({ tokenHash })
      .exec();

    if (existingMarker) {
      return this.handleExistingMarker(existingMarker, now);
    }

    const family = await this.refreshTokenFamilyModel
      .findOne({
        currentTokenHash: tokenHash,
        status: RefreshTokenFamilyStatus.Active,
        expiresAt: { $gt: now },
      })
      .exec();

    if (!family) {
      this.denyRefresh();
    }

    const operationId = randomUUID();
    try {
      await this.replayMarkerModel.create({
        tokenHash,
        familyId: family.familyId,
        status: RefreshTokenReplayMarkerStatus.Pending,
        rotationOperationId: operationId,
        leaseExpiresAt: new Date(now.getTime() + rotationLeaseMs),
        expiresAt: family.expiresAt,
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        const racedMarker = await this.replayMarkerModel
          .findOne({ tokenHash })
          .exec();
        if (racedMarker) {
          return this.handleExistingMarker(racedMarker, now);
        }
      }
      this.denyRefresh();
    }

    return { family, operationId };
  }

  private async handleExistingMarker(
    marker: RefreshTokenReplayMarkerPersistence,
    now: Date,
  ): Promise<PreparedRotation> {
    if (marker.status === RefreshTokenReplayMarkerStatus.Committed) {
      await this.revokeAsReplay(marker.familyId);
      this.denyRefresh();
    }

    const family = await this.refreshTokenFamilyModel
      .findOne({ familyId: marker.familyId })
      .exec();

    if (family?.lastRotationOperationId === marker.rotationOperationId) {
      await this.finalizeAndRevoke(
        marker.familyId,
        marker.tokenHash,
        marker.rotationOperationId,
        'refresh-rotation-orphaned',
      );
      this.denyRefresh();
    }

    const canTakeOver =
      family?.status === RefreshTokenFamilyStatus.Active &&
      family.currentTokenHash === marker.tokenHash &&
      family.expiresAt > now;

    if (!canTakeOver) {
      await this.finalizeAndRevoke(
        marker.familyId,
        marker.tokenHash,
        marker.rotationOperationId,
        'refresh-rotation-invariant',
      );
      this.denyRefresh();
    }

    if (!marker.leaseExpiresAt) {
      await this.finalizeAndRevoke(
        marker.familyId,
        marker.tokenHash,
        marker.rotationOperationId,
        'refresh-rotation-invariant',
      );
      this.denyRefresh();
    }

    if (marker.leaseExpiresAt && marker.leaseExpiresAt > now) {
      this.denyRefresh();
    }

    const operationId = randomUUID();
    const takenOver = await this.replayMarkerModel
      .findOneAndUpdate(
        {
          tokenHash: marker.tokenHash,
          status: RefreshTokenReplayMarkerStatus.Pending,
          rotationOperationId: marker.rotationOperationId,
          leaseExpiresAt: { $lte: now },
        },
        {
          $set: {
            rotationOperationId: operationId,
            leaseExpiresAt: new Date(now.getTime() + rotationLeaseMs),
          },
        },
        { new: true },
      )
      .exec();

    if (!takenOver) {
      this.denyRefresh();
    }

    return { family, operationId };
  }

  private async recoverAfterInterruptedCas(
    familyId: string,
    tokenHash: string,
    operationId: string,
  ): Promise<void> {
    try {
      const family = await this.refreshTokenFamilyModel
        .findOne({ familyId })
        .exec();
      const reason =
        family?.lastRotationOperationId === operationId
          ? 'refresh-rotation-orphaned'
          : 'refresh-rotation-invariant';

      if (
        family?.status === RefreshTokenFamilyStatus.Active &&
        family.currentTokenHash === tokenHash &&
        family.expiresAt > new Date()
      ) {
        return;
      }

      await this.finalizeAndRevoke(familyId, tokenHash, operationId, reason);
    } catch {
      // The pending marker remains eligible for bounded reconciliation.
    }
  }

  private async finalizeAndRevoke(
    familyId: string,
    tokenHash: string,
    operationId: string,
    reason: string,
  ): Promise<void> {
    await this.commitMarker(tokenHash, operationId).catch(() => null);
    await this.revokeFamily(familyId, reason);
  }

  private async commitMarker(
    tokenHash: string,
    operationId: string,
  ): Promise<RefreshTokenReplayMarkerPersistence | null> {
    return this.replayMarkerModel
      .findOneAndUpdate(
        {
          tokenHash,
          status: RefreshTokenReplayMarkerStatus.Pending,
          rotationOperationId: operationId,
        },
        {
          $set: {
            status: RefreshTokenReplayMarkerStatus.Committed,
            committedAt: new Date(),
          },
          $unset: { leaseExpiresAt: 1 },
        },
        { new: true },
      )
      .exec();
  }

  private async revokeAsReplay(familyId: string): Promise<void> {
    await this.refreshTokenFamilyModel.updateMany(
      { familyId, status: RefreshTokenFamilyStatus.Active },
      this.revocationUpdate(
        RefreshTokenFamilyStatus.Replayed,
        'refresh-token-replay',
      ),
    );
  }

  private revocationUpdate(status: RefreshTokenFamilyStatus, reason: string) {
    return {
      $set: {
        status,
        revokedAt: new Date(),
        revokedReason: reason,
      },
      $unset: { currentTokenHash: 1 },
    };
  }

  private rotationResult(
    family: RefreshTokenFamilyPersistence,
    refreshToken: string,
  ): RefreshTokenRotationResult {
    return {
      familyId: family.familyId,
      clientId: family.clientId,
      subjectType: family.subjectType,
      subjectId: family.subjectId,
      scopes: family.scopes,
      authVersion: family.authVersion ?? 0,
      refreshToken,
      expiresAt: family.expiresAt,
    };
  }

  private generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    );
  }

  private denyRefresh(): never {
    throw new UnauthorizedException(genericRefreshDenial);
  }
}
