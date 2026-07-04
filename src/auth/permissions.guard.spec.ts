import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthPermission } from '../common/enums/auth-permission.enum';
import { StaffRole } from '../common/enums/library-status.enum';
import { PermissionsGuard } from './permissions.guard';
import { PermissionsService } from './permissions.service';

function createExecutionContext(user?: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard and permission mapping', () => {
  let reflector: Reflector;
  let permissionsService: PermissionsService;

  beforeEach(() => {
    reflector = new Reflector();
    permissionsService = new PermissionsService();
  });

  it('maps staff and admin roles to stable permissions', () => {
    expect(
      permissionsService.permissionsForStaffRoles([StaffRole.Staff]),
    ).toEqual(
      expect.arrayContaining([
        AuthPermission.CatalogRead,
        AuthPermission.CatalogManage,
        AuthPermission.MembershipTypesManage,
        AuthPermission.BorrowingsManage,
      ]),
    );
    expect(
      permissionsService.permissionsForStaffRoles([StaffRole.Admin]),
    ).toEqual(
      expect.arrayContaining([
        AuthPermission.StaffUsersManage,
        AuthPermission.RolesManage,
        AuthPermission.SecurityEventsRead,
      ]),
    );
  });

  it('denies by default when permission metadata is missing', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const guard = new PermissionsGuard(reflector, permissionsService);

    expect(() =>
      guard.canActivate(
        createExecutionContext({
          id: 'staff-user-id',
          roleArea: 'staff',
          permissions: [AuthPermission.CatalogRead],
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects member tokens from staff permissions', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([AuthPermission.CatalogRead]);
    const guard = new PermissionsGuard(reflector, permissionsService);

    expect(() =>
      guard.canActivate(
        createExecutionContext({
          id: 'member-id',
          roleArea: 'member',
          permissions: [AuthPermission.MemberSelfRead],
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows authenticated users with all required permissions', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([AuthPermission.CatalogRead]);
    const guard = new PermissionsGuard(reflector, permissionsService);

    expect(
      guard.canActivate(
        createExecutionContext({
          id: 'staff-user-id',
          roleArea: 'staff',
          permissions: [AuthPermission.CatalogRead],
        }),
      ),
    ).toBe(true);
  });
});
