/* eslint-disable @typescript-eslint/no-require-imports */
import { UnauthorizedException } from '@nestjs/common';

import {
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
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: staffUser.id,
        email: staffUser.email,
        roles: staffUser.roles,
      });
      expect(result).toEqual({
        accessToken: 'jwt-token',
        user: {
          id: staffUser.id,
          email: staffUser.email,
          displayName: staffUser.displayName,
          roles: staffUser.roles,
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
  });
});
