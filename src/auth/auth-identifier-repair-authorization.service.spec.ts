import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthPermission } from '../common/enums/auth-permission.enum';
import {
  StaffRole,
  StaffUserStatus,
} from '../common/enums/library-status.enum';
import { AuthIdentifierRepairAuthorizationService } from './auth-identifier-repair-authorization.service';

describe('AuthIdentifierRepairAuthorizationService', () => {
  const payload = {
    iss: 'issuer',
    sub: 'admin-id',
    aud: 'audience',
    exp: Math.floor(Date.now() / 1000) + 300,
    iat: Math.floor(Date.now() / 1000),
    jti: 'token-id',
    role_area: 'staff' as const,
    scope: AuthPermission.AuthIdentifiersManage,
    permissions: [AuthPermission.AuthIdentifiersManage],
    auth_version: 4,
  };
  const jwtService = {
    verifyAsync: jest.fn().mockResolvedValue(payload),
  };
  const staffUsersService = {
    findActiveById: jest.fn().mockResolvedValue({
      id: 'admin-id',
      roles: [StaffRole.Admin],
      status: StaffUserStatus.Active,
      authVersion: 4,
    }),
  };
  const config = {
    get: jest.fn((key: string) =>
      ({
        'auth.jwtSecret': 'secret',
        'auth.issuer': 'issuer',
        'auth.audience': 'audience',
      })[key],
    ),
  };
  let service: AuthIdentifierRepairAuthorizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    jwtService.verifyAsync.mockResolvedValue(payload);
    staffUsersService.findActiveById.mockResolvedValue({
      id: 'admin-id',
      roles: [StaffRole.Admin],
      status: StaffUserStatus.Active,
      authVersion: 4,
    });
    service = new AuthIdentifierRepairAuthorizationService(
      jwtService as unknown as JwtService,
      staffUsersService as never,
      config as unknown as ConfigService,
    );
  });

  it('validates token and current administrator authorization for dry-run', async () => {
    await expect(service.authorizeDryRun('opaque-token')).resolves.toMatchObject({
      subjectId: 'admin-id',
      authVersion: 4,
    });
    expect(staffUsersService.findActiveById).toHaveBeenCalledWith('admin-id');
  });

  it('revalidates current account and authVersion before every mutation boundary', async () => {
    await service.authorizeMutation('opaque-token');
    await service.authorizeMutation('opaque-token');
    expect(jwtService.verifyAsync).toHaveBeenCalledTimes(2);
    expect(staffUsersService.findActiveById).toHaveBeenCalledTimes(2);

    staffUsersService.findActiveById.mockResolvedValueOnce({
      id: 'admin-id',
      roles: [StaffRole.Admin],
      status: StaffUserStatus.Active,
      authVersion: 5,
    });
    await expect(service.authorizeMutation('opaque-token')).rejects.toMatchObject({
      status: 401,
      message: 'Repair authorization required',
    });
  });

  it.each([
    ['expired token', () => jwtService.verifyAsync.mockRejectedValueOnce(new Error('expired'))],
    [
      'non-admin role',
      () =>
        staffUsersService.findActiveById.mockResolvedValueOnce({
          id: 'admin-id',
          roles: [StaffRole.Staff],
          status: StaffUserStatus.Active,
          authVersion: 4,
        }),
    ],
    [
      'missing permission',
      () =>
        jwtService.verifyAsync.mockResolvedValueOnce({
          ...payload,
          permissions: [],
          scope: '',
        }),
    ],
  ])('returns one redacted denial for %s', async (_label, arrange) => {
    arrange();
    await expect(service.authorizeMutation('sensitive-token')).rejects.toMatchObject(
      {
        status: 401,
        message: 'Repair authorization required',
      },
    );
  });
});
