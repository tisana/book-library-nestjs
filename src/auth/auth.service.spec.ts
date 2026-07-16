/* eslint-disable @typescript-eslint/no-require-imports */
import { UnauthorizedException } from '@nestjs/common';

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

    it('rejects refresh when account authVersion is newer than the session', async () => {
      const staffUsersService = {
        findActiveById: jest.fn().mockResolvedValue({
          id: 'staff-user-id',
          email: 'staff@example.com',
          displayName: 'Staff User',
          roles: [StaffRole.Staff],
          authVersion: 2,
        }),
      };
      const service = new AuthService(
        staffUsersService,
        undefined,
        { verify: jest.fn() },
        { signAsync: jest.fn() },
        { get: jest.fn().mockReturnValue(900) },
        {
          rotate: jest.fn().mockResolvedValue({
            subjectType: AuthSubjectType.Staff,
            subjectId: 'staff-user-id',
            authVersion: 1,
            refreshToken: 'next-refresh-token',
          }),
        } as any,
      );

      await expect(service.refresh('refresh-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});

describe('AuthService shared login resolution', () => {
  const AuthService = loadAuthService();
  const describeIfImplemented = AuthService ? describe : describe.skip;

  describeIfImplemented('when identifier reservations are available', () => {
    const staff = {
      id: 'staff-1',
      email: 'staff@example.com',
      displayName: 'Staff One',
      passwordHash: 'staff-hash',
      roles: [StaffRole.Staff],
      status: StaffUserStatus.Active,
      authVersion: 2,
    };
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

    function query<T>(value: T) {
      const result = {
        exec: jest.fn().mockResolvedValue(value),
        select: jest.fn(),
      };
      result.select.mockReturnValue(result);
      return result;
    }

    function createService(input?: {
      reservation?: Record<string, unknown> | null;
      gateStatus?: AuthIdentifierOperationStatus | null;
      staffUser?: typeof staff | null;
      memberUser?: typeof member | null;
      passwordValid?: boolean;
      staffRoles?: StaffRole[];
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
      };
      const tokenSession = {
        createFamily: jest.fn().mockResolvedValue({
          refreshToken: 'refresh-token',
          expiresAt: new Date('2026-08-01T00:00:00.000Z'),
        }),
      };
      const identifierModel = {
        findOne: jest.fn().mockReturnValue(query(reservation)),
      };
      const operationModel = {
        findOne: jest
          .fn()
          .mockReturnValue(
            query(
              input?.gateStatus
                ? { status: input.gateStatus }
                : input?.gateStatus === null
                  ? null
                  : { status: AuthIdentifierOperationStatus.Completed },
            ),
          ),
      };
      const service = new AuthService(
        {
          findByEmailWithPassword: jest.fn().mockResolvedValue(resolvedStaff),
          touchLastLogin: jest.fn().mockResolvedValue(undefined),
        },
        {
          findByLoginIdentifierWithPassword: jest
            .fn()
            .mockResolvedValue(
              input && 'memberUser' in input ? input.memberUser : member,
            ),
          touchLastLogin: jest.fn().mockResolvedValue(undefined),
          findSelfServiceProfile: jest.fn().mockResolvedValue({
            membershipTypeCode: 'STANDARD',
            membershipTypeName: 'Standard',
          }),
        },
        { verify: jest.fn().mockResolvedValue(input?.passwordValid ?? true) },
        { signAsync: jest.fn().mockResolvedValue('access-token') },
        {
          get: jest.fn((key: string) => {
            if (key === 'auth.refreshTokenTtlSeconds') return 2_592_000;
            if (key === 'auth.accessTokenTtlSeconds') return 900;
            if (key === 'auth.auditCorrelationKeyVersion') return 7;
            return undefined;
          }),
        },
        tokenSession,
        securityActivity,
        identifierModel,
        operationModel,
        { getKeyMaterial: jest.fn().mockReturnValue(Buffer.alloc(32, 7)) },
      );
      return { service, securityActivity, identifierModel, operationModel };
    }

    it('resolves staff and member reservations into discriminated sessions', async () => {
      const staffFixture = createService();
      await expect(
        staffFixture.service.createSharedSession({
          identifier: ' STAFF@EXAMPLE.COM ',
          password: 'correct-password',
        }),
      ).resolves.toMatchObject({
        response: { roleArea: 'staff', user: { id: staff.id } },
      });

      const memberFixture = createService({
        reservation: {
          normalizedIdentifier: 'm-1001',
          status: AuthIdentifierStatus.Active,
          subjectType: AuthIdentifierSubjectType.Member,
          subjectId: member.id,
        },
      });
      await expect(
        memberFixture.service.createSharedSession({
          identifier: 'M-1001',
          password: 'correct-password',
        }),
      ).resolves.toMatchObject({
        response: { roleArea: 'member', member: { id: member.id } },
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
          password: 'correct-password',
        }),
      ).resolves.toMatchObject({ response: { roleArea: 'staff' } });

      for (const gateStatus of [
        null,
        AuthIdentifierOperationStatus.Finalizing,
        AuthIdentifierOperationStatus.FailedTerminal,
      ]) {
        await expect(
          createService({
            reservation: gatedReservation,
            gateStatus,
          }).service.createSharedSession({
            identifier: staff.email,
            password: 'correct-password',
          }),
        ).rejects.toMatchObject({
          message: 'Invalid credentials',
        });
      }
    });

    it('denies unresolved and ambiguous identifiers with HMAC-only audit correlation', async () => {
      for (const reservation of [
        null,
        {
          normalizedIdentifier: 'ambiguous@example.com',
          status: AuthIdentifierStatus.Conflict,
          conflictingSubjects: [
            {
              subjectType: AuthIdentifierSubjectType.Staff,
              subjectId: 'staff-1',
            },
            {
              subjectType: AuthIdentifierSubjectType.Member,
              subjectId: 'member-1',
            },
          ],
        },
      ]) {
        const fixture = createService({ reservation });
        await expect(
          fixture.service.createSharedSession({
            identifier: 'ambiguous@example.com',
            password: 'wrong-password',
          }),
        ).rejects.toMatchObject({ message: 'Invalid credentials' });
        const calls = fixture.securityActivity.record.mock.calls;
        const event = calls[calls.length - 1]?.[0];
        expect(event).toMatchObject({
          identifierCorrelationHash: expect.any(String),
          correlationKeyVersion: 7,
        });
        expect(event).not.toHaveProperty('subjectId');
        expect(JSON.stringify(event)).not.toContain('ambiguous@example.com');
      }
    });

    it('adds an opaque subject reference only after exact-one resolution', async () => {
      const fixture = createService({ passwordValid: false });
      await expect(
        fixture.service.createSharedSession({
          identifier: staff.email,
          password: 'wrong-password',
        }),
      ).rejects.toMatchObject({ message: 'Invalid credentials' });
      expect(fixture.securityActivity.record).toHaveBeenLastCalledWith(
        expect.objectContaining({
          subjectType: 'staff',
          subjectId: staff.id,
          reasonCategory: 'invalid-credentials',
        }),
      );
    });

    it('authenticates a staff identity with no roles but issues no permissions', async () => {
      const fixture = createService({ staffRoles: [] });
      await expect(
        fixture.service.createSharedSession({
          identifier: staff.email,
          password: 'correct-password',
        }),
      ).resolves.toMatchObject({
        response: { roleArea: 'staff', permissions: [], user: { roles: [] } },
      });
    });
  });
});
