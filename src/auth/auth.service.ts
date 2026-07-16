import { createHmac, randomUUID } from 'node:crypto';
import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PasswordHasherService } from './password-hasher.service';
import {
  MemberAuthStatus,
  MemberStatus,
  StaffUserStatus,
} from '../common/enums/library-status.enum';
import {
  memberRolePermissions,
  permissionsForStaffRoles,
} from '../common/enums/auth-permission.enum';
import { MemberLoginDto, MemberLoginResponseDto } from './dto/member-auth.dto';
import { MembersService, getMemberId } from '../members/members.service';
import { LoginDto, LoginResponseDto } from '../staff-users/dto/staff-user.dto';
import {
  getStaffUserId,
  StaffUsersService,
} from '../staff-users/staff-users.service';
import { TokenSessionService } from './token-session.service';
import { AuthSubjectType } from './schemas/refresh-token-family.schema';
import { SecurityActivityService } from './security-activity.service';
import {
  SecurityActivityActorType,
  SecurityActivityEventType,
  SecurityActivityOutcome,
} from './schemas/security-activity-event.schema';
import { AuthPermission } from '../common/enums/auth-permission.enum';
import {
  SharedLoginDto,
  SharedLoginResponseDto,
  SharedMemberLoginResponseDto,
  SharedStaffLoginResponseDto,
} from './dto/shared-login.dto';
import {
  AuthIdentifierDocument,
  AuthIdentifierModelName,
  AuthIdentifierStatus,
  AuthIdentifierSubjectType,
} from './schemas/auth-identifier.schema';
import {
  AuthIdentifierOperationDocument,
  AuthIdentifierOperationModelName,
  AuthIdentifierOperationStatus,
} from './schemas/auth-identifier-operation.schema';
import { AuthIdentifierRepairKeyPolicyService } from './auth-identifier-repair-key-policy.service';

export const refreshCookieName = 'book_library_refresh';

export interface StaffAuthSessionResult {
  response: LoginResponseDto;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface MemberAuthSessionResult {
  response: MemberLoginResponseDto;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface SharedAuthSessionResult {
  response: SharedLoginResponseDto;
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly staffUsersService: StaffUsersService,
    private readonly membersService: MembersService | undefined,
    private readonly passwordHasher: PasswordHasherService,
    private readonly jwtService: JwtService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly tokenSessionService?: TokenSessionService,
    @Optional()
    private readonly securityActivityService?: SecurityActivityService,
    @Optional()
    @InjectModel(AuthIdentifierModelName)
    private readonly authIdentifierModel?: Model<AuthIdentifierDocument>,
    @Optional()
    @InjectModel(AuthIdentifierOperationModelName)
    private readonly authIdentifierOperationModel?: Model<AuthIdentifierOperationDocument>,
    @Optional()
    private readonly identifierKeyPolicy?: AuthIdentifierRepairKeyPolicyService,
  ) {}

  async createSharedSession(
    dto: SharedLoginDto,
  ): Promise<SharedAuthSessionResult> {
    const identifier = this.normalizeSharedIdentifier(dto.identifier);
    const password = typeof dto.password === 'string' ? dto.password : '';
    const reservation = await this.resolveSharedIdentifier(identifier);

    if (!reservation) {
      await this.denySharedSignIn(identifier, 'unresolved-identifier');
    }

    await this.assertActivationGateCompleted(reservation, identifier);

    if (reservation.subjectType === AuthIdentifierSubjectType.Staff) {
      const staffAuth = await this.authenticateReservedStaff(
        identifier,
        password,
        reservation.subjectId,
      );
      const response = await this.buildStaffLoginResponse(staffAuth);
      const refreshSession = await this.createRefreshToken({
        subjectType: AuthSubjectType.Staff,
        subjectId: staffAuth.userId,
        scopes: staffAuth.permissions,
        authVersion: staffAuth.authVersion,
      });

      await this.recordSecurityActivity({
        eventType: SecurityActivityEventType.SignInSuccess,
        actorType: SecurityActivityActorType.Staff,
        actorId: staffAuth.userId,
        subjectType: 'staff',
        subjectId: staffAuth.userId,
        outcome: SecurityActivityOutcome.Success,
      });
      return { response, ...refreshSession };
    }

    const memberAuth = await this.authenticateReservedMember(
      identifier,
      password,
      reservation.subjectId,
    );
    const response = await this.buildMemberLoginResponse(memberAuth);
    const refreshSession = await this.createRefreshToken({
      subjectType: AuthSubjectType.Member,
      subjectId: memberAuth.memberId,
      scopes: memberAuth.permissions,
      authVersion: memberAuth.authVersion,
    });

    await this.recordSecurityActivity({
      eventType: SecurityActivityEventType.SignInSuccess,
      actorType: SecurityActivityActorType.Member,
      actorId: memberAuth.memberId,
      subjectType: 'member',
      subjectId: memberAuth.memberId,
      outcome: SecurityActivityOutcome.Success,
    });
    return { response, ...refreshSession };
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const staffAuth = await this.authenticateStaff(dto);
    const response = await this.buildStaffLoginResponse(staffAuth);

    await this.recordSecurityActivity({
      eventType: SecurityActivityEventType.SignInSuccess,
      actorType: SecurityActivityActorType.Staff,
      actorId: staffAuth.userId,
      subjectType: 'staff',
      subjectId: staffAuth.userId,
      outcome: SecurityActivityOutcome.Success,
    });

    return response;
  }

  async createStaffSession(dto: LoginDto): Promise<StaffAuthSessionResult> {
    const staffAuth = await this.authenticateStaff(dto);
    const response = await this.buildStaffLoginResponse(staffAuth);
    const refreshSession = await this.createRefreshToken({
      subjectType: AuthSubjectType.Staff,
      subjectId: staffAuth.userId,
      scopes: staffAuth.permissions,
      authVersion: staffAuth.authVersion,
    });

    await this.recordSecurityActivity({
      eventType: SecurityActivityEventType.SignInSuccess,
      actorType: SecurityActivityActorType.Staff,
      actorId: staffAuth.userId,
      subjectType: 'staff',
      subjectId: staffAuth.userId,
      outcome: SecurityActivityOutcome.Success,
    });

    return { response, ...refreshSession };
  }

  async memberLogin(dto: MemberLoginDto): Promise<MemberLoginResponseDto> {
    const memberAuth = await this.authenticateMember(dto);
    const response = await this.buildMemberLoginResponse(memberAuth);

    await this.recordSecurityActivity({
      eventType: SecurityActivityEventType.SignInSuccess,
      actorType: SecurityActivityActorType.Member,
      actorId: memberAuth.memberId,
      subjectType: 'member',
      subjectId: memberAuth.memberId,
      outcome: SecurityActivityOutcome.Success,
    });

    return response;
  }

  async createMemberSession(
    dto: MemberLoginDto,
  ): Promise<MemberAuthSessionResult> {
    const memberAuth = await this.authenticateMember(dto);
    const response = await this.buildMemberLoginResponse(memberAuth);
    const refreshSession = await this.createRefreshToken({
      subjectType: AuthSubjectType.Member,
      subjectId: memberAuth.memberId,
      scopes: response.permissions,
      authVersion: memberAuth.authVersion,
    });

    await this.recordSecurityActivity({
      eventType: SecurityActivityEventType.SignInSuccess,
      actorType: SecurityActivityActorType.Member,
      actorId: memberAuth.memberId,
      subjectType: 'member',
      subjectId: memberAuth.memberId,
      outcome: SecurityActivityOutcome.Success,
    });

    return { response, ...refreshSession };
  }

  async refresh(refreshToken: string): Promise<{
    response: LoginResponseDto | MemberLoginResponseDto;
    refreshToken: string;
    refreshExpiresAt: Date;
  }> {
    if (!this.tokenSessionService) {
      throw new UnauthorizedException('Refresh sessions are unavailable');
    }

    const rotated = await this.tokenSessionService
      .rotate(refreshToken)
      .catch(async (error: unknown) => {
        await this.recordSecurityActivity({
          eventType: SecurityActivityEventType.RefreshReplayDetected,
          actorType: SecurityActivityActorType.Unknown,
          outcome: SecurityActivityOutcome.Failure,
          reasonCategory: 'invalid-refresh-token',
        });
        throw error;
      });

    if (rotated.subjectType === AuthSubjectType.Member) {
      const member = await this.membersService?.findActiveById(
        rotated.subjectId,
      );

      if (!member || (member.authVersion ?? 0) !== rotated.authVersion) {
        throw new UnauthorizedException('Invalid refresh session');
      }

      const memberId = getMemberId(member);
      const response = await this.buildMemberLoginResponse({
        member,
        memberId,
        permissions: [...memberRolePermissions],
        authVersion: member.authVersion ?? 0,
      });

      await this.recordSecurityActivity({
        eventType: SecurityActivityEventType.TokenRefreshed,
        actorType: SecurityActivityActorType.Member,
        actorId: memberId,
        subjectType: 'member',
        subjectId: memberId,
        outcome: SecurityActivityOutcome.Success,
      });

      return {
        response,
        refreshToken: rotated.refreshToken,
        refreshExpiresAt: rotated.expiresAt,
      };
    }

    const user = await this.staffUsersService.findActiveById(rotated.subjectId);

    if ((user.authVersion ?? 0) !== rotated.authVersion) {
      throw new UnauthorizedException('Invalid refresh session');
    }

    const userId = getStaffUserId(user);
    const permissions = permissionsForStaffRoles(user.roles);
    const response = await this.buildStaffLoginResponse({
      user,
      userId,
      permissions,
      scope: permissions.join(' '),
      authVersion: user.authVersion ?? 0,
    });

    await this.recordSecurityActivity({
      eventType: SecurityActivityEventType.TokenRefreshed,
      actorType: SecurityActivityActorType.Staff,
      actorId: userId,
      subjectType: 'staff',
      subjectId: userId,
      outcome: SecurityActivityOutcome.Success,
    });

    return {
      response,
      refreshToken: rotated.refreshToken,
      refreshExpiresAt: rotated.expiresAt,
    };
  }

  async logout(refreshToken?: string): Promise<void> {
    await this.tokenSessionService?.revokeRefreshToken(
      refreshToken,
      'sign-out',
    );
    await this.recordSecurityActivity({
      eventType: SecurityActivityEventType.SignOut,
      actorType: SecurityActivityActorType.Unknown,
      outcome: SecurityActivityOutcome.Success,
    });
  }

  async logoutAll(authContext: {
    roleArea: 'staff' | 'member';
    subjectId: string;
  }): Promise<void> {
    const subjectType =
      authContext.roleArea === 'member'
        ? AuthSubjectType.Member
        : AuthSubjectType.Staff;

    await this.tokenSessionService?.revokeSubject(
      subjectType,
      authContext.subjectId,
      'sign-out-all',
    );

    if (authContext.roleArea === 'member') {
      await this.membersService?.bumpAuthVersion(authContext.subjectId);
    } else {
      await this.staffUsersService.bumpAuthVersion(authContext.subjectId);
    }

    await this.recordSecurityActivity({
      eventType: SecurityActivityEventType.TokenRevoked,
      actorType:
        authContext.roleArea === 'member'
          ? SecurityActivityActorType.Member
          : SecurityActivityActorType.Staff,
      actorId: authContext.subjectId,
      subjectType: authContext.roleArea,
      subjectId: authContext.subjectId,
      outcome: SecurityActivityOutcome.Success,
      reasonCategory: 'sign-out-all',
    });
  }

  getRefreshCookieTtlSeconds(): number {
    return this.configService?.get<number>('auth.refreshTokenTtlSeconds') ?? 0;
  }

  getRefreshCookieOptions(expiresAt?: Date) {
    return this.getRequiredTokenSessionService().getRefreshCookieOptions(
      expiresAt ?? this.getRefreshCookieTtlSeconds(),
    );
  }

  getClearRefreshCookieOptions() {
    return this.getRequiredTokenSessionService().getClearRefreshCookieOptions();
  }

  getAccessTokenTtlSeconds(): number {
    return this.configService?.get<number>('auth.accessTokenTtlSeconds') ?? 900;
  }

  private async authenticateStaff(dto: LoginDto) {
    const user = await this.staffUsersService.findByEmailWithPassword(
      dto.email,
    );

    if (
      !user ||
      user.status !== StaffUserStatus.Active ||
      !(await this.passwordHasher.verify(user.passwordHash, dto.password))
    ) {
      await this.recordSecurityActivity({
        eventType: SecurityActivityEventType.SignInFailure,
        actorType: SecurityActivityActorType.Unknown,
        outcome: SecurityActivityOutcome.Failure,
        reasonCategory: 'invalid-credentials',
        context: { email: dto.email },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const userId = getStaffUserId(user);

    await this.staffUsersService.touchLastLogin(userId);
    const permissions = permissionsForStaffRoles(user.roles);
    const scope = permissions.join(' ');

    return {
      user,
      userId,
      permissions,
      scope,
      authVersion: user.authVersion ?? 0,
    };
  }

  private async buildStaffLoginResponse(staffAuth: {
    user: Awaited<ReturnType<StaffUsersService['findByEmailWithPassword']>>;
    userId: string;
    permissions: AuthPermission[];
    scope: string;
    authVersion: number;
  }): Promise<SharedStaffLoginResponseDto> {
    const user = staffAuth.user;

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      accessToken: await this.jwtService.signAsync({
        sub: staffAuth.userId,
        jti: randomUUID(),
        email: user.email,
        roles: user.roles,
        roleArea: 'staff',
        role_area: 'staff',
        scope: staffAuth.scope,
        permissions: staffAuth.permissions,
        auth_version: staffAuth.authVersion,
      }),
      tokenType: 'Bearer',
      expiresIn: this.getAccessTokenTtlSeconds(),
      scope: staffAuth.scope,
      permissions: staffAuth.permissions,
      roleArea: 'staff',
      user: {
        id: staffAuth.userId,
        email: user.email,
        displayName: user.displayName,
        roles: user.roles,
        permissions: staffAuth.permissions,
      },
    };
  }

  private async authenticateMember(dto: MemberLoginDto) {
    const member = await this.membersService?.findByLoginIdentifierWithPassword(
      dto.loginIdentifier,
    );

    if (
      !member ||
      member.status !== MemberStatus.Active ||
      member.authStatus !== MemberAuthStatus.Active ||
      !member.passwordHash ||
      !(await this.passwordHasher.verify(member.passwordHash, dto.password))
    ) {
      await this.recordSecurityActivity({
        eventType: SecurityActivityEventType.SignInFailure,
        actorType: SecurityActivityActorType.Unknown,
        outcome: SecurityActivityOutcome.Failure,
        reasonCategory: 'invalid-credentials',
        context: { loginIdentifier: dto.loginIdentifier },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const memberId = getMemberId(member);

    await this.membersService?.touchLastLogin(memberId);
    const permissions = [...memberRolePermissions];

    return {
      member,
      memberId,
      permissions,
      authVersion: member.authVersion ?? 0,
    };
  }

  private async buildMemberLoginResponse(memberAuth: {
    member: Awaited<
      ReturnType<MembersService['findByLoginIdentifierWithPassword']>
    >;
    memberId: string;
    permissions: AuthPermission[];
    authVersion: number;
  }): Promise<SharedMemberLoginResponseDto> {
    const member = memberAuth.member;

    if (!member) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const profile = await this.membersService?.findSelfServiceProfile(
      memberAuth.memberId,
    );
    const scope = memberAuth.permissions.join(' ');

    return {
      accessToken: await this.jwtService.signAsync({
        sub: memberAuth.memberId,
        jti: randomUUID(),
        memberNumber: member.memberNumber,
        roleArea: 'member',
        role_area: 'member',
        scope,
        permissions: memberAuth.permissions,
        auth_version: memberAuth.authVersion,
      }),
      tokenType: 'Bearer',
      expiresIn: this.getAccessTokenTtlSeconds(),
      scope,
      permissions: memberAuth.permissions,
      roleArea: 'member',
      member: {
        id: memberAuth.memberId,
        memberNumber: member.memberNumber,
        displayName: member.fullName,
        email: member.email,
        membershipStatus: member.status,
        membershipTypeId: member.membershipTypeId.toString(),
        membershipTypeCode: profile?.membershipTypeCode ?? '',
        membershipTypeName: profile?.membershipTypeName ?? '',
      },
    };
  }

  private async createRefreshToken(input: {
    subjectType: AuthSubjectType;
    subjectId: string;
    scopes: AuthPermission[];
    authVersion: number;
  }): Promise<{ refreshToken: string; refreshExpiresAt: Date }> {
    if (!this.tokenSessionService) {
      throw new UnauthorizedException('Refresh sessions are unavailable');
    }

    const session = await this.getRequiredTokenSessionService().createFamily({
      clientId: 'book-library-web',
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      scopes: input.scopes,
      authVersion: input.authVersion,
      ttlSeconds: this.getRefreshCookieTtlSeconds(),
    });

    return {
      refreshToken: session.refreshToken,
      refreshExpiresAt: session.expiresAt,
    };
  }

  private getRequiredTokenSessionService(): TokenSessionService {
    if (!this.tokenSessionService) {
      throw new UnauthorizedException('Refresh sessions are unavailable');
    }

    return this.tokenSessionService;
  }

  private normalizeSharedIdentifier(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }
    return value.trim().toLowerCase();
  }

  private async resolveSharedIdentifier(
    normalizedIdentifier: string,
  ): Promise<AuthIdentifierDocument | null> {
    if (!normalizedIdentifier || !this.authIdentifierModel) {
      return null;
    }

    const reservation = await this.authIdentifierModel
      .findOne({ normalizedIdentifier })
      .exec();
    if (
      !reservation ||
      reservation.status !== AuthIdentifierStatus.Active ||
      !reservation.subjectType ||
      !reservation.subjectId
    ) {
      const reason =
        reservation?.status === AuthIdentifierStatus.Conflict
          ? 'legacy-ambiguous-identifier'
          : 'unresolved-identifier';
      await this.denySharedSignIn(normalizedIdentifier, reason);
    }

    return reservation;
  }

  private async assertActivationGateCompleted(
    reservation: AuthIdentifierDocument,
    normalizedIdentifier: string,
  ): Promise<void> {
    if (!reservation.activationGateOperationId) {
      return;
    }

    const operation = await this.authIdentifierOperationModel
      ?.findOne({ operationId: reservation.activationGateOperationId })
      .select({ status: 1 })
      .exec();
    if (operation?.status !== AuthIdentifierOperationStatus.Completed) {
      await this.denySharedSignIn(
        normalizedIdentifier,
        'activation-gate-incomplete',
      );
    }
  }

  private async authenticateReservedStaff(
    normalizedIdentifier: string,
    password: string,
    reservedSubjectId: string,
  ) {
    const user =
      await this.staffUsersService.findByEmailWithPassword(
        normalizedIdentifier,
      );
    const matchesReservation =
      user && getStaffUserId(user) === reservedSubjectId;
    if (
      !matchesReservation ||
      user.status !== StaffUserStatus.Active ||
      !(await this.passwordHasher.verify(user.passwordHash, password))
    ) {
      await this.denySharedSignIn(normalizedIdentifier, 'invalid-credentials', {
        subjectType: 'staff',
        subjectId: reservedSubjectId,
      });
    }

    const userId = getStaffUserId(user);
    await this.staffUsersService.touchLastLogin(userId);
    const permissions = permissionsForStaffRoles(user.roles);
    return {
      user,
      userId,
      permissions,
      scope: permissions.join(' '),
      authVersion: user.authVersion ?? 0,
    };
  }

  private async authenticateReservedMember(
    normalizedIdentifier: string,
    password: string,
    reservedSubjectId: string,
  ) {
    const member =
      await this.membersService?.findByLoginIdentifierWithPassword(
        normalizedIdentifier,
      );
    const matchesReservation =
      member && getMemberId(member) === reservedSubjectId;
    if (
      !matchesReservation ||
      member.status !== MemberStatus.Active ||
      member.authStatus !== MemberAuthStatus.Active ||
      !member.passwordHash ||
      !(await this.passwordHasher.verify(member.passwordHash, password))
    ) {
      await this.denySharedSignIn(normalizedIdentifier, 'invalid-credentials', {
        subjectType: 'member',
        subjectId: reservedSubjectId,
      });
    }

    const memberId = getMemberId(member);
    await this.membersService?.touchLastLogin(memberId);
    return {
      member,
      memberId,
      permissions: [...memberRolePermissions],
      authVersion: member.authVersion ?? 0,
    };
  }

  private async denySharedSignIn(
    normalizedIdentifier: string,
    reasonCategory: string,
    subject?: { subjectType: 'staff' | 'member'; subjectId: string },
  ): Promise<never> {
    const correlation = this.identifierCorrelation(normalizedIdentifier);
    await this.recordSecurityActivity({
      eventType: SecurityActivityEventType.SignInFailure,
      actorType: SecurityActivityActorType.Unknown,
      ...(subject
        ? { subjectType: subject.subjectType, subjectId: subject.subjectId }
        : {}),
      outcome: SecurityActivityOutcome.Failure,
      reasonCategory,
      identifierCorrelationHash: correlation?.hash,
      correlationKeyVersion: correlation?.version,
    });
    throw new UnauthorizedException('Invalid credentials');
  }

  private identifierCorrelation(
    normalizedIdentifier: string,
  ): { hash: string; version: number } | undefined {
    if (!normalizedIdentifier || !this.identifierKeyPolicy) {
      return undefined;
    }
    const version =
      this.configService?.get<number>('auth.auditCorrelationKeyVersion') ??
      this.configService?.get<number>(
        'auth.auditCorrelationKeyRing.currentVersion',
      );
    const material = version
      ? this.identifierKeyPolicy.getKeyMaterial(version)
      : undefined;
    if (!version || !material) {
      return undefined;
    }
    const key = Buffer.isBuffer(material)
      ? material
      : Buffer.from(material, 'base64url');
    return {
      hash: createHmac('sha256', key)
        .update('book-library/auth-sign-in/v1\0', 'utf8')
        .update(normalizedIdentifier, 'utf8')
        .digest('base64url'),
      version,
    };
  }

  private async recordSecurityActivity(
    input: Parameters<SecurityActivityService['record']>[0],
  ): Promise<void> {
    await this.securityActivityService?.record(input);
  }
}
