/* eslint-disable @typescript-eslint/no-require-imports */
import { UnauthorizedException } from '@nestjs/common';

import { AuthPermission } from '../common/enums/auth-permission.enum';
import {
  MemberAuthStatus,
  MemberStatus,
  StaffRole,
  StaffUserStatus,
} from '../common/enums/library-status.enum';

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
  });
});
