import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AuthSubjectType,
  RefreshTokenFamilyDocument,
  RefreshTokenFamilyModelName,
  RefreshTokenFamilyStatus,
} from './schemas/refresh-token-family.schema';

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
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge: number;
}

@Injectable()
export class TokenSessionService {
  constructor(
    @InjectModel(RefreshTokenFamilyModelName)
    private readonly refreshTokenFamilyModel: Model<RefreshTokenFamilyDocument>,
  ) {}

  async createFamily(
    input: CreateRefreshTokenFamilyInput,
  ): Promise<RefreshTokenRotationResult> {
    const refreshToken = this.generateRefreshToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + input.ttlSeconds * 1000);
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
    });

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
    const tokenHash = this.hashRefreshToken(refreshToken);
    const now = new Date();
    const family = await this.refreshTokenFamilyModel
      .findOne({
        currentTokenHash: tokenHash,
        status: RefreshTokenFamilyStatus.Active,
        expiresAt: { $gt: now },
      })
      .exec();

    if (!family) {
      await this.markReplayIfPreviousToken(tokenHash);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const nextRefreshToken = this.generateRefreshToken();

    family.previousTokenHash = family.currentTokenHash;
    family.currentTokenHash = this.hashRefreshToken(nextRefreshToken);
    family.lastRotatedAt = now;
    await family.save();

    return {
      familyId: family.familyId,
      clientId: family.clientId,
      subjectType: family.subjectType,
      subjectId: family.subjectId,
      scopes: family.scopes,
      authVersion: family.authVersion ?? 0,
      refreshToken: nextRefreshToken,
      expiresAt: family.expiresAt,
    };
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
      {
        $set: {
          status: RefreshTokenFamilyStatus.Revoked,
          revokedAt: new Date(),
          revokedReason: reason,
        },
      },
    );
  }

  async revokeFamily(familyId: string, reason: string): Promise<void> {
    await this.refreshTokenFamilyModel.updateMany(
      { familyId, status: RefreshTokenFamilyStatus.Active },
      {
        $set: {
          status: RefreshTokenFamilyStatus.Revoked,
          revokedAt: new Date(),
          revokedReason: reason,
        },
      },
    );
  }

  async revokeSubject(
    subjectType: AuthSubjectType,
    subjectId: string,
    reason: string,
  ): Promise<void> {
    await this.refreshTokenFamilyModel.updateMany(
      { subjectType, subjectId, status: RefreshTokenFamilyStatus.Active },
      {
        $set: {
          status: RefreshTokenFamilyStatus.Revoked,
          revokedAt: new Date(),
          revokedReason: reason,
        },
      },
    );
  }

  hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  getRefreshCookieOptions(
    ttlSeconds: number,
    isProduction = process.env.NODE_ENV === 'production',
  ): RefreshCookieOptions {
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/auth',
      maxAge: ttlSeconds * 1000,
    };
  }

  getClearRefreshCookieOptions(
    isProduction = process.env.NODE_ENV === 'production',
  ): RefreshCookieOptions {
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/auth',
      maxAge: 0,
    };
  }

  private generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private async markReplayIfPreviousToken(tokenHash: string): Promise<void> {
    const family = await this.refreshTokenFamilyModel
      .findOne({
        previousTokenHash: tokenHash,
        status: RefreshTokenFamilyStatus.Active,
      })
      .exec();

    if (!family) {
      return;
    }

    family.status = RefreshTokenFamilyStatus.Replayed;
    family.revokedAt = new Date();
    family.revokedReason = 'refresh-token-replay';
    await family.save();
  }
}
