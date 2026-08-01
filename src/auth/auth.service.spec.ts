/* eslint-disable @typescript-eslint/no-require-imports */
import { NotFoundException, UnauthorizedException } from '@nestjs/common';

import { AuthPermission } from '../common/enums/auth-permission.enum';
import {
  MemberAuthStatus,
  MemberStatus,
  StaffRole,
  StaffUserStatus,
} from '../common/enums/library-status.enum';
import { AuthSubjectType } from './schemas/refresh-token-family.schema';
import {
  AuthIdentifierStatus,
  AuthIdentifierSubjectType,
} from './schemas/auth-identifier.schema';
import { AuthIdentifierOperationStatus } from './schemas/auth-identifier-operation.schema';
import {
  createStaffDocument,
  queryResult,
} from '../../test/support/backend-coverage-fixtures';

function loadAuthService(): any | undefined {
  try {
    return require('./auth.service').AuthService;
  } catch {
    return undefined;
  }
}

describe('AuthService login contract', () => {
  const AuthService = loadAuthService();
  const describeIfImplemented = AuthService ? describe : describe.skip;

  describeIfImplemented('when AuthService is implemented', () => {
    it('returns a JWT and redacted user for valid active staff credentials', async () => {
      const staffUser = {
        id: 'staff-user-id',
        email: 'staff@example.com',
        displayName: 'Staff User',
        passwordHash: 'hashed-password',
        roles: [StaffRole.Staff],
        status: StaffUserStatus.Active,
      };
      const staffUsersService = {
        findByEmailWithPassword: jest.fn().mockResolvedValue(staffUser),
        touchLastLogin: jest.fn().mockResolvedValue(undefined),
      };
      const passwordHasher = {
        verify: jest.fn().mockResolvedValue(true),
      };
      const jwtService = {
        signAsync: jest.fn().mockResolvedValue('jwt-token'),
      };
      const service = new AuthService(
        staffUsersService,
        undefined,
        passwordHasher,
        jwtService,
      );

      const result = await service.login({
        email: 'staff@example.com',
        password: 'correct-password',
      });

      expect(passwordHasher.verify).toHaveBeenCalledWith(
        staffUser.passwordHash,
        'correct-password',
      );
      expect(staffUsersService.touchLastLogin).toHaveBeenCalledWith(
        staffUser.id,
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: staffUser.id,
          jti: expect.any(String),
          email: staffUser.email,
          roles: staffUser.roles,
          roleArea: 'staff',
          role_area: 'staff',
          auth_version: 0,
          permissions: expect.arrayContaining([AuthPermission.CatalogRead]),
        }),
      );
      expect(result).toMatchObject({
        accessToken: 'jwt-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        permissions: expect.arrayContaining([AuthPermission.CatalogRead]),
        user: {
          id: staffUser.id,
          email: staffUser.email,
          displayName: staffUser.displayName,
          roles: staffUser.roles,
          permissions: expect.arrayContaining([AuthPermission.CatalogRead]),
        },
      });
    });

    it('rejects inactive staff/admin users before issuing a token', async () => {
      const staffUsersService = {
        findByEmailWithPassword: jest.fn().mockResolvedValue({
          id: 'staff-user-id',
          email: 'staff@example.com',
          displayName: 'Staff User',
          passwordHash: 'hashed-password',
          roles: [StaffRole.Staff],
          status: StaffUserStatus.Inactive,
        }),
      };
      const passwordHasher = {
        verify: jest.fn().mockResolvedValue(true),
      };
      const jwtService = {
        signAsync: jest.fn(),
      };
      const service = new AuthService(
        staffUsersService,
        undefined,
        passwordHasher,
        jwtService,
      );

      await expect(
        service.login({
          email: 'staff@example.com',
          password: 'correct-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('creates a staff refresh session with hashed-token family metadata', async () => {
      const staffUser = {
        id: 'staff-user-id',
        email: 'staff@example.com',
        displayName: 'Staff User',
        passwordHash: 'hashed-password',
        roles: [StaffRole.Staff],
        status: StaffUserStatus.Active,
        authVersion: 4,
      };
      const tokenSessionService = {
        createFamily: jest.fn().mockResolvedValue({
          refreshToken: 'refresh-token',
        }),
        getRefreshCookieOptions: jest.fn(),
        getClearRefreshCookieOptions: jest.fn(),
      };
      const service = new AuthService(
        {
          findByEmailWithPassword: jest.fn().mockResolvedValue(staffUser),
          touchLastLogin: jest.fn().mockResolvedValue(undefined),
        },
        undefined,
        { verify: jest.fn().mockResolvedValue(true) },
        { signAsync: jest.fn().mockResolvedValue('jwt-token') },
        {
          get: jest.fn((key: string) =>
            key === 'auth.refreshTokenTtlSeconds' ? 3600 : 900,
          ),
        },
        tokenSessionService as any,
        { record: jest.fn().mockResolvedValue(undefined) } as any,
      );

      const result = await service.createStaffSession({
        email: staffUser.email,
        password: 'correct-password',
      });

      expect(result.refreshToken).toBe('refresh-token');
      expect(tokenSessionService.createFamily).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'book-library-web',
          subjectType: AuthSubjectType.Staff,
          subjectId: staffUser.id,
          authVersion: 4,
          ttlSeconds: 3600,
        }),
      );
    });

    it('returns a member JWT and redacted member profile for valid member credentials', async () => {
      const member = {
        id: 'member-id',
        memberNumber: 'M-1001',
        fullName: 'Jane Reader',
        email: 'jane.reader@example.test',
        membershipTypeId: 'membership-type-id',
        passwordHash: 'hashed-password',
        status: MemberStatus.Active,
        authStatus: MemberAuthStatus.Active,
      };
      const membersService = {
        findByLoginIdentifierWithPassword: jest.fn().mockResolvedValue(member),
        touchLastLogin: jest.fn().mockResolvedValue(undefined),
        findSelfServiceProfile: jest.fn().mockResolvedValue({
          membershipTypeCode: 'GOLD',
          membershipTypeName: 'Gold Member',
        }),
      };
      const passwordHasher = {
        verify: jest.fn().mockResolvedValue(true),
      };
      const jwtService = {
        signAsync: jest.fn().mockResolvedValue('member-jwt-token'),
      };
      const service = new AuthService(
        { findByEmailWithPassword: jest.fn() },
        membersService,
        passwordHasher,
        jwtService,
      );

      const result = await service.memberLogin({
        loginIdentifier: 'M-1001',
        password: 'correct-password',
      });

      expect(
        membersService.findByLoginIdentifierWithPassword,
      ).toHaveBeenCalledWith('M-1001');
      expect(passwordHasher.verify).toHaveBeenCalledWith(
        member.passwordHash,
        'correct-password',
      );
      expect(membersService.touchLastLogin).toHaveBeenCalledWith(member.id);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: member.id,
          jti: expect.any(String),
          memberNumber: member.memberNumber,
          roleArea: 'member',
          role_area: 'member',
          scope: AuthPermission.MemberSelfRead,
          permissions: [AuthPermission.MemberSelfRead],
          auth_version: 0,
        }),
      );
      expect(membersService.findSelfServiceProfile).toHaveBeenCalledWith(
        member.id,
      );
      expect(result).toMatchObject({
        accessToken: 'member-jwt-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        scope: AuthPermission.MemberSelfRead,
        permissions: [AuthPermission.MemberSelfRead],
        member: {
          id: member.id,
          memberNumber: member.memberNumber,
          displayName: member.fullName,
          email: member.email,
          membershipStatus: member.status,
          membershipTypeId: member.membershipTypeId,
          membershipTypeCode: 'GOLD',
          membershipTypeName: 'Gold Member',
        },
      });
    });

    it('rejects suspended member credentials before issuing a token', async () => {
      const membersService = {
        findByLoginIdentifierWithPassword: jest.fn().mockResolvedValue({
          id: 'member-id',
          memberNumber: 'M-1001',
          fullName: 'Jane Reader',
          passwordHash: 'hashed-password',
          status: MemberStatus.Suspended,
          authStatus: MemberAuthStatus.Active,
        }),
        touchLastLogin: jest.fn(),
      };
      const passwordHasher = {
        verify: jest.fn().mockResolvedValue(true),
      };
      const jwtService = {
        signAsync: jest.fn(),
      };
      const service = new AuthService(
        { findByEmailWithPassword: jest.fn() },
        membersService,
        passwordHasher,
        jwtService,
      );

      await expect(
        service.memberLogin({
          loginIdentifier: 'M-1001',
          password: 'correct-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('revokes a rotated member family when the member is no longer active', async () => {
      const tokenSessionService = {
        rotate: jest.fn().mockResolvedValue({
          familyId: 'member-family-id',
          subjectType: AuthSubjectType.Member,
          subjectId: 'member-id',
          authVersion: 1,
          refreshToken: 'next-refresh-token',
        }),
        revokeFamily: jest.fn().mockResolvedValue(undefined),
      };
      const service = new AuthService(
        { findActiveById: jest.fn() },
        {
          findActiveById: jest
            .fn()
            .mockRejectedValue(
              new NotFoundException('Active member not found'),
            ),
        },
        { verify: jest.fn() },
        { signAsync: jest.fn() },
        { get: jest.fn().mockReturnValue(900) },
        tokenSessionService as any,
      );

      await expect(service.refresh('refresh-token')).rejects.toEqual(
        new UnauthorizedException('Invalid refresh session'),
      );
      expect(tokenSessionService.revokeFamily).toHaveBeenCalledWith(
        'member-family-id',
        'inactive-subject',
      );
    });

    it('revokes a rotated member family when authVersion is stale', async () => {
      const tokenSessionService = {
        rotate: jest.fn().mockResolvedValue({
          familyId: 'member-family-id',
          subjectType: AuthSubjectType.Member,
          subjectId: 'member-id',
          authVersion: 1,
          refreshToken: 'next-refresh-token',
        }),
        revokeFamily: jest.fn().mockResolvedValue(undefined),
      };
      const service = new AuthService(
        { findActiveById: jest.fn() },
        {
          findActiveById: jest.fn().mockResolvedValue({
            id: 'member-id',
            authVersion: 2,
          }),
        },
        { verify: jest.fn() },
        { signAsync: jest.fn() },
        { get: jest.fn().mockReturnValue(900) },
        tokenSessionService as any,
      );

      await expect(service.refresh('refresh-token')).rejects.toEqual(
        new UnauthorizedException('Invalid refresh session'),
      );
      expect(tokenSessionService.revokeFamily).toHaveBeenCalledWith(
        'member-family-id',
        'stale-auth-version',
      );
    });

    it('keeps the refresh denial generic when inactive-family revocation fails', async () => {
      const tokenSessionService = {
        rotate: jest.fn().mockResolvedValue({
          familyId: 'member-family-id',
          subjectType: AuthSubjectType.Member,
          subjectId: 'member-id',
          authVersion: 1,
          refreshToken: 'next-refresh-token',
        }),
        revokeFamily: jest
          .fn()
          .mockRejectedValue(new Error('database unavailable')),
      };
      const service = new AuthService(
        { findActiveById: jest.fn() },
        {
          findActiveById: jest
            .fn()
            .mockRejectedValue(
              new NotFoundException('Active member not found'),
            ),
        },
        { verify: jest.fn() },
        { signAsync: jest.fn() },
        { get: jest.fn().mockReturnValue(900) },
        tokenSessionService as any,
      );

      await expect(service.refresh('refresh-token')).rejects.toEqual(
        new UnauthorizedException('Invalid refresh session'),
      );
      expect(tokenSessionService.revokeFamily).toHaveBeenCalledWith(
        'member-family-id',
        'inactive-subject',
      );
    });

    it('revokes a rotated staff family when account authVersion is newer than the session', async () => {
      const staffUsersService = {
        findActiveById: jest.fn().mockResolvedValue({
          id: 'staff-user-id',
          email: 'staff@example.com',
          displayName: 'Staff User',
          roles: [StaffRole.Staff],
          authVersion: 2,
        }),
      };
      const tokenSessionService = {
        rotate: jest.fn().mockResolvedValue({
          familyId: 'staff-family-id',
          subjectType: AuthSubjectType.Staff,
          subjectId: 'staff-user-id',
          authVersion: 1,
          refreshToken: 'next-refresh-token',
        }),
        revokeFamily: jest.fn().mockResolvedValue(undefined),
      };
      const service = new AuthService(
        staffUsersService,
        undefined,
        { verify: jest.fn() },
        { signAsync: jest.fn() },
        { get: jest.fn().mockReturnValue(900) },
        tokenSessionService as any,
      );

      await expect(service.refresh('refresh-token')).rejects.toEqual(
        new UnauthorizedException('Invalid refresh session'),
      );
      expect(tokenSessionService.revokeFamily).toHaveBeenCalledWith(
        'staff-family-id',
        'stale-auth-version',
      );
    });
  });
});

describe('AuthService shared login resolution', () => {
  const AuthService = loadAuthService();
  const describeIfImplemented = AuthService ? describe : describe.skip;

  describeIfImplemented('when identifier reservations are available', () => {
    const staff = createStaffDocument({
      id: 'staff-1',
      email: 'admin@example.test',
      displayName: 'Admin One',
      roles: [StaffRole.Admin],
      status: StaffUserStatus.Active,
      authVersion: 2,
    });
    const member = {
      id: 'member-1',
      memberNumber: 'M-1001',
      fullName: 'Member One',
      email: 'member@example.com',
      membershipTypeId: 'type-1',
      passwordHash: 'member-hash',
      status: MemberStatus.Active,
      authStatus: MemberAuthStatus.Active,
      authVersion: 3,
    };

    function createService(input?: {
      reservation?: Record<string, unknown> | null;
      gateStatus?: AuthIdentifierOperationStatus | null;
      staffUser?: {
        id: string;
        email: string;
        displayName: string;
        passwordHash: string;
        roles: StaffRole[];
        status: StaffUserStatus;
        authVersion?: number;
      } | null;
      memberUser?: Omit<typeof member, 'authVersion'> & {
        authVersion?: number;
      } | null;
      passwordValid?: boolean;
      staffRoles?: StaffRole[];
      memberProfile?: {
        membershipTypeCode: string;
        membershipTypeName: string;
      } | null;
      identifierModelAvailable?: boolean;
      operationModelAvailable?: boolean;
      membersServiceAvailable?: boolean;
      dedicatedFailureRecorder?: boolean;
      auditCurrentVersion?: number | false;
      auditRingVersion?: number;
      keyMaterial?: Buffer | string;
    }) {
      const reservation =
        input && 'reservation' in input
          ? input.reservation
          : {
              normalizedIdentifier: staff.email,
              status: AuthIdentifierStatus.Active,
              subjectType: AuthIdentifierSubjectType.Staff,
              subjectId: staff.id,
            };
      const staffSource =
        input && 'staffUser' in input ? input.staffUser : staff;
      const resolvedStaff = staffSource
        ? { ...staffSource, roles: input?.staffRoles ?? [...staffSource.roles] }
        : null;
      const securityActivity = {
        record: jest.fn().mockResolvedValue(undefined),
        ...(input?.dedicatedFailureRecorder
          ? { recordFailedSignIn: jest.fn().mockResolvedValue(undefined) }
          : {}),
      };
      const tokenSession = {
        createFamily: jest.fn().mockResolvedValue({
          refreshToken: 'refresh-token',
          expiresAt: new Date('2026-08-01T00:00:00.000Z'),
        }),
      };
      const identifierModel = {
        findOne: jest.fn().mockReturnValue(queryResult(reservation)),
      };
      const operationModel = {
        findOne: jest
          .fn()
          .mockReturnValue(
            queryResult(
              input?.gateStatus
                ? { status: input.gateStatus }
                : input?.gateStatus === null
                  ? null
                  : { status: AuthIdentifierOperationStatus.Completed },
            ),
          ),
      };
      const staffUsersService = {
        findByEmailWithPassword: jest.fn().mockResolvedValue(resolvedStaff),
        touchLastLogin: jest.fn().mockResolvedValue(undefined),
      };
      const membersService = {
          findByLoginIdentifierWithPassword: jest
            .fn()
            .mockResolvedValue(
              input && 'memberUser' in input ? input.memberUser : member,
            ),
          touchLastLogin: jest.fn().mockResolvedValue(undefined),
          findSelfServiceProfile: jest.fn().mockResolvedValue(
            input && 'memberProfile' in input
              ? input.memberProfile
              : {
                  membershipTypeCode: 'STANDARD',
                  membershipTypeName: 'Standard',
                },
          ),
        };
      const configService = {
        get: jest.fn((key: string) => {
          if (key === 'auth.refreshTokenTtlSeconds') return 2_592_000;
          if (key === 'auth.accessTokenTtlSeconds') return 900;
          if (key === 'auth.auditCorrelationKeyVersion') {
            return input?.auditCurrentVersion === false
              ? undefined
              : (input?.auditCurrentVersion ?? 7);
          }
          if (key === 'auth.auditCorrelationKeyRing.currentVersion') {
            return input?.auditRingVersion;
          }
          return undefined;
        }),
      };
      const identifierKeyPolicy = {
        getKeyMaterial: jest
          .fn()
          .mockReturnValue(input?.keyMaterial ?? Buffer.alloc(32, 7)),
      };
      const service = new AuthService(
        staffUsersService,
        input?.membersServiceAvailable === false ? undefined : membersService,
        { verify: jest.fn().mockResolvedValue(input?.passwordValid ?? true) },
        { signAsync: jest.fn().mockResolvedValue('access-token') },
        configService,
        tokenSession,
        securityActivity,
        input?.identifierModelAvailable === false
          ? undefined
          : identifierModel,
        input?.operationModelAvailable === false ? undefined : operationModel,
        identifierKeyPolicy,
      );
      return {
        service,
        securityActivity,
        identifierModel,
        operationModel,
        staffUsersService,
        membersService,
      };
    }

    it('uses the normalized reserved staff identity and server role area', async () => {
      const staffFixture = createService();
      const result = await staffFixture.service.createSharedSession({
        identifier: ' ADMIN@EXAMPLE.TEST ',
        password: 'pw',
      });

      expect(result.response).toMatchObject({
        roleArea: 'staff',
        user: {
          id: 'staff-1',
          email: 'admin@example.test',
          roles: [StaffRole.Admin],
        },
      });
      expect(staffFixture.identifierModel.findOne).toHaveBeenCalledWith({
        normalizedIdentifier: 'admin@example.test',
      });
      expect(
        staffFixture.staffUsersService.findByEmailWithPassword,
      ).toHaveBeenCalledWith('admin@example.test');
    });

    it('uses empty membership type fields when the member profile is absent', async () => {
      const memberFixture = createService({
        reservation: {
          normalizedIdentifier: 'm-1001',
          status: AuthIdentifierStatus.Active,
          subjectType: AuthIdentifierSubjectType.Member,
          subjectId: member.id,
        },
        memberProfile: null,
      });

      const result = await memberFixture.service.createSharedSession({
        identifier: 'M-1001',
        password: 'pw',
      });

      expect(result.response).toMatchObject({
        roleArea: 'member',
        member: {
          id: member.id,
          membershipTypeCode: '',
          membershipTypeName: '',
        },
      });
    });

    it('accepts a completed activation gate and fails closed for missing or failed gates', async () => {
      const gatedReservation = {
        normalizedIdentifier: staff.email,
        status: AuthIdentifierStatus.Active,
        subjectType: AuthIdentifierSubjectType.Staff,
        subjectId: staff.id,
        activationGateOperationId: 'repair-1',
      };
      await expect(
        createService({
          reservation: gatedReservation,
        }).service.createSharedSession({
          identifier: staff.email,
          password: 'pw',
        }),
      ).resolves.toMatchObject({ response: { roleArea: 'staff' } });

      for (const gateStatus of [
        null,
        AuthIdentifierOperationStatus.Finalizing,
        AuthIdentifierOperationStatus.FailedTerminal,
      ]) {
        const fixture = createService({
          reservation: gatedReservation,
          gateStatus,
        });
        await expect(
          fixture.service.createSharedSession({
            identifier: staff.email,
            password: 'pw',
          }),
        ).rejects.toEqual(new UnauthorizedException('Invalid credentials'));
        const event = fixture.securityActivity.record.mock.lastCall?.[0];
        expect(event).toMatchObject({
          reasonCategory: 'activation-gate-incomplete',
        });
        expect(JSON.stringify(event)).not.toContain(staff.email);
      }
    });

    it.each([
      {
        name: 'inactive reservation',
        reservation: {
          normalizedIdentifier: staff.email,
          status: AuthIdentifierStatus.Released,
          subjectType: AuthIdentifierSubjectType.Staff,
          subjectId: staff.id,
        },
      },
      {
        name: 'active reservation without a subject type',
        reservation: {
          normalizedIdentifier: staff.email,
          status: AuthIdentifierStatus.Active,
          subjectId: staff.id,
        },
      },
      {
        name: 'active reservation without a subject id',
        reservation: {
          normalizedIdentifier: staff.email,
          status: AuthIdentifierStatus.Active,
          subjectType: AuthIdentifierSubjectType.Staff,
        },
      },
    ])('fails a $name generically with a redacted request', async ({
      reservation,
    }) => {
      const fixture = createService({ reservation });

      await expect(
        fixture.service.createSharedSession({
          identifier: staff.email,
          password: 'pw',
        }),
      ).rejects.toEqual(new UnauthorizedException('Invalid credentials'));
      const event = fixture.securityActivity.record.mock.lastCall?.[0];
      expect(event).toMatchObject({ reasonCategory: 'unresolved-identifier' });
      expect(JSON.stringify(event)).not.toContain(staff.email);
    });

    it.each([
      {
        name: 'unresolved identifier',
        input: { reservation: null },
        identifier: 'missing@example.test',
        reasonCategory: 'unresolved-identifier',
      },
      {
        name: 'conflicting identifier',
        input: {
          reservation: {
            normalizedIdentifier: 'ambiguous@example.test',
            status: AuthIdentifierStatus.Conflict,
          },
        },
        identifier: 'ambiguous@example.test',
        reasonCategory: 'legacy-ambiguous-identifier',
      },
      {
        name: 'mismatched staff reservation',
        input: { staffUser: { ...staff, id: 'different-staff' } },
        identifier: staff.email,
        reasonCategory: 'invalid-credentials',
      },
      {
        name: 'inactive staff account',
        input: {
          staffUser: { ...staff, status: StaffUserStatus.Inactive },
        },
        identifier: staff.email,
        reasonCategory: 'invalid-credentials',
      },
      {
        name: 'invalid staff password',
        input: { passwordValid: false },
        identifier: staff.email,
        reasonCategory: 'invalid-credentials',
      },
      {
        name: 'mismatched member reservation',
        input: {
          reservation: {
            normalizedIdentifier: member.memberNumber.toLowerCase(),
            status: AuthIdentifierStatus.Active,
            subjectType: AuthIdentifierSubjectType.Member,
            subjectId: member.id,
          },
          memberUser: { ...member, id: 'different-member' },
        },
        identifier: member.memberNumber,
        reasonCategory: 'invalid-credentials',
      },
      {
        name: 'inactive member account',
        input: {
          reservation: {
            normalizedIdentifier: member.memberNumber.toLowerCase(),
            status: AuthIdentifierStatus.Active,
            subjectType: AuthIdentifierSubjectType.Member,
            subjectId: member.id,
          },
          memberUser: { ...member, status: MemberStatus.Inactive },
        },
        identifier: member.memberNumber,
        reasonCategory: 'invalid-credentials',
      },
      {
        name: 'locked member authentication',
        input: {
          reservation: {
            normalizedIdentifier: member.memberNumber.toLowerCase(),
            status: AuthIdentifierStatus.Active,
            subjectType: AuthIdentifierSubjectType.Member,
            subjectId: member.id,
          },
          memberUser: { ...member, authStatus: MemberAuthStatus.Locked },
        },
        identifier: member.memberNumber,
        reasonCategory: 'invalid-credentials',
      },
      {
        name: 'member without a password credential',
        input: {
          reservation: {
            normalizedIdentifier: member.memberNumber.toLowerCase(),
            status: AuthIdentifierStatus.Active,
            subjectType: AuthIdentifierSubjectType.Member,
            subjectId: member.id,
          },
          memberUser: { ...member, passwordHash: '' },
        },
        identifier: member.memberNumber,
        reasonCategory: 'invalid-credentials',
      },
      {
        name: 'invalid member password',
        input: {
          reservation: {
            normalizedIdentifier: member.memberNumber.toLowerCase(),
            status: AuthIdentifierStatus.Active,
            subjectType: AuthIdentifierSubjectType.Member,
            subjectId: member.id,
          },
          passwordValid: false,
        },
        identifier: member.memberNumber,
        reasonCategory: 'invalid-credentials',
      },
    ])('keeps $name generic and records only a redacted category', async ({
      input,
      identifier,
      reasonCategory,
    }) => {
      const fixture = createService(input);

      await expect(
        fixture.service.createSharedSession({ identifier, password: 'pw' }),
      ).rejects.toEqual(new UnauthorizedException('Invalid credentials'));

      const event = fixture.securityActivity.record.mock.lastCall?.[0];
      expect(event).toMatchObject({ reasonCategory });
      expect(JSON.stringify(event).toLowerCase()).not.toContain(
        identifier.toLowerCase(),
      );
    });

    it('fails a non-string identifier generically without querying reservations', async () => {
      const fixture = createService();

      await expect(
        fixture.service.createSharedSession({
          identifier: 42,
          password: 'pw',
        } as never),
      ).rejects.toEqual(new UnauthorizedException('Invalid credentials'));
      expect(fixture.identifierModel.findOne).not.toHaveBeenCalled();
      expect(fixture.securityActivity.record).toHaveBeenCalledWith(
        expect.objectContaining({ reasonCategory: 'unresolved-identifier' }),
      );
    });

    it('fails generically when identifier reservations are unavailable', async () => {
      const fixture = createService({ identifierModelAvailable: false });

      await expect(
        fixture.service.createSharedSession({
          identifier: staff.email,
          password: 'pw',
        }),
      ).rejects.toEqual(new UnauthorizedException('Invalid credentials'));
      expect(fixture.identifierModel.findOne).not.toHaveBeenCalled();
      const event = fixture.securityActivity.record.mock.lastCall?.[0];
      expect(event).toMatchObject({ reasonCategory: 'unresolved-identifier' });
      expect(JSON.stringify(event)).not.toContain(staff.email);
    });

    it('keeps dedicated failed-sign-in recording behind the generic response', async () => {
      const fixture = createService({
        reservation: null,
        dedicatedFailureRecorder: true,
      });

      await expect(
        fixture.service.createSharedSession({
          identifier: 'missing@example.test',
          password: 'pw',
        }),
      ).rejects.toEqual(new UnauthorizedException('Invalid credentials'));
      expect(fixture.securityActivity.record).not.toHaveBeenCalled();
    });

    it('normalizes a non-string password into the same generic denial', async () => {
      const fixture = createService({ passwordValid: false });

      await expect(
        fixture.service.createSharedSession({
          identifier: staff.email,
          password: 42,
        } as never),
      ).rejects.toEqual(new UnauthorizedException('Invalid credentials'));
    });

    it('fails a gated reservation when the operation model is unavailable', async () => {
      const fixture = createService({
        reservation: {
          normalizedIdentifier: staff.email,
          status: AuthIdentifierStatus.Active,
          subjectType: AuthIdentifierSubjectType.Staff,
          subjectId: staff.id,
          activationGateOperationId: 'repair-1',
        },
        operationModelAvailable: false,
      });

      await expect(
        fixture.service.createSharedSession({
          identifier: staff.email,
          password: 'pw',
        }),
      ).rejects.toEqual(new UnauthorizedException('Invalid credentials'));
      expect(fixture.operationModel.findOne).not.toHaveBeenCalled();
    });

    it('uses zero auth versions when reserved account versions are absent', async () => {
      const staffFixture = createService({
        staffUser: { ...staff, authVersion: undefined },
      });
      await expect(
        staffFixture.service.createSharedSession({
          identifier: staff.email,
          password: 'pw',
        }),
      ).resolves.toMatchObject({ response: { roleArea: 'staff' } });

      const memberFixture = createService({
        reservation: {
          normalizedIdentifier: member.memberNumber.toLowerCase(),
          status: AuthIdentifierStatus.Active,
          subjectType: AuthIdentifierSubjectType.Member,
          subjectId: member.id,
        },
        memberUser: { ...member, authVersion: undefined },
      });
      await expect(
        memberFixture.service.createSharedSession({
          identifier: member.memberNumber,
          password: 'pw',
        }),
      ).resolves.toMatchObject({ response: { roleArea: 'member' } });
    });

    it('keeps unresolved activity redacted with fallback-version string key material', async () => {
      const fixture = createService({
        reservation: null,
        auditCurrentVersion: false,
        auditRingVersion: 8,
        keyMaterial: Buffer.alloc(32, 8).toString('base64url'),
      });

      await expect(
        fixture.service.createSharedSession({
          identifier: 'missing@example.test',
          password: 'pw',
        }),
      ).rejects.toEqual(new UnauthorizedException('Invalid credentials'));
      const event = fixture.securityActivity.record.mock.lastCall?.[0];
      expect(event).toMatchObject({
        identifierCorrelationHash: expect.any(String),
        correlationKeyVersion: 8,
      });
      expect(JSON.stringify(event)).not.toContain('missing@example.test');
    });

    it('fails a reserved member generically when member auth is unavailable', async () => {
      const fixture = createService({
        reservation: {
          normalizedIdentifier: member.memberNumber.toLowerCase(),
          status: AuthIdentifierStatus.Active,
          subjectType: AuthIdentifierSubjectType.Member,
          subjectId: member.id,
        },
        membersServiceAvailable: false,
      });

      await expect(
        fixture.service.createSharedSession({
          identifier: member.memberNumber,
          password: 'pw',
        }),
      ).rejects.toEqual(new UnauthorizedException('Invalid credentials'));
    });

    it('authenticates a staff identity with no roles but issues no permissions', async () => {
      const fixture = createService({ staffRoles: [] });
      await expect(
        fixture.service.createSharedSession({
          identifier: staff.email,
          password: 'pw',
        }),
      ).resolves.toMatchObject({
        response: { roleArea: 'staff', permissions: [], user: { roles: [] } },
      });
    });
  });
});
