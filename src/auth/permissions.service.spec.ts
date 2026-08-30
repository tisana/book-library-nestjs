import {
  AuthPermission,
  NormalizedAuthContext,
  memberRolePermissions,
  staffRolePermissions,
} from '../common/enums/auth-permission.enum';
import { StaffRole } from '../common/enums/library-status.enum';
import { PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
  const service = new PermissionsService();
  const authContext: NormalizedAuthContext = {
    subjectId: 'staff-1',
    roleArea: 'staff',
    roles: [StaffRole.Staff],
    permissions: [AuthPermission.CatalogRead],
    authVersion: 3,
    scope: AuthPermission.CatalogRead,
  };

  it.each([undefined, '', '   '])(
    'returns no permissions for empty scope %p',
    (scope) => {
      expect(service.permissionsFromScope(scope)).toEqual([]);
    },
  );

  it('filters unknown permissions from scopes and payload arrays', () => {
    expect(
      service.permissionsFromScope('catalog:read unknown members:read'),
    ).toEqual([AuthPermission.CatalogRead, AuthPermission.MembersRead]);

    expect(
      service.buildStaffContext(
        { id: 'staff-1' } as never,
        {
          permissions: [AuthPermission.CatalogRead, 'unknown:permission'],
          scope: AuthPermission.MembersRead,
        },
      ).permissions,
    ).toEqual([AuthPermission.CatalogRead]);
  });

  it('uses default staff roles and payload permissions before role permissions', () => {
    const defaultContext = service.buildStaffContext({ id: 'staff-1' } as never);
    const payloadContext = service.buildStaffContext(
      { id: 'staff-2', roles: [StaffRole.Staff] } as never,
      { permissions: [AuthPermission.RolesRead] },
    );

    expect(defaultContext.roles).toEqual([StaffRole.Staff]);
    expect(defaultContext.permissions).toEqual(staffRolePermissions[StaffRole.Staff]);
    expect(payloadContext.permissions).toEqual([AuthPermission.RolesRead]);
  });

  it('builds member contexts with default member permissions and token metadata', () => {
    const audience = ['library-api', 'staff-web'];
    const context = service.buildMemberContext(
      { id: 'member-1' } as never,
      {
        auth_version: 7,
        aud: audience,
        iss: 'https://issuer.example',
        jti: 'token-1',
      },
    );

    expect(context).toEqual({
      subjectId: 'member-1',
      roleArea: 'member',
      roles: ['member'],
      permissions: [...memberRolePermissions],
      authVersion: 7,
      issuer: 'https://issuer.example',
      audience,
      tokenId: 'token-1',
      scope: AuthPermission.MemberSelfRead,
    });
  });

  it('uses scoped payload permissions and account auth versions when present', () => {
    const staff = service.buildStaffContext(
      { id: 'staff-3', authVersion: 9 } as never,
      { roles: [StaffRole.Admin], scope: AuthPermission.RolesRead },
    );
    const member = service.buildMemberContext(
      { id: 'member-2', authVersion: 4 } as never,
      { scope: AuthPermission.CatalogRead },
    );

    expect(staff.roles).toEqual([StaffRole.Admin]);
    expect(staff.permissions).toEqual([AuthPermission.RolesRead]);
    expect(staff.authVersion).toBe(9);
    expect(member.permissions).toEqual([AuthPermission.CatalogRead]);
    expect(member.authVersion).toBe(4);
  });

  it('prefers embedded authContext and rejects incomplete request users', () => {
    expect(service.normalizeRequestContext()).toBeUndefined();
    expect(service.normalizeRequestContext({ id: 'staff-1' })).toBeUndefined();
    expect(service.normalizeRequestContext({ authContext })).toBe(authContext);
  });

  it('normalizes a complete request user and requires every requested permission', () => {
    const normalized = service.normalizeRequestContext({
      id: 'member-1',
      roleArea: 'member',
      permissions: [AuthPermission.MemberSelfRead],
      authVersion: 2,
    });

    expect(normalized).toEqual({
      subjectId: 'member-1',
      roleArea: 'member',
      roles: ['member'],
      permissions: [AuthPermission.MemberSelfRead],
      authVersion: 2,
      issuer: undefined,
      audience: undefined,
      tokenId: undefined,
      scope: undefined,
    });
    expect(
      service.hasEveryPermission(undefined, [AuthPermission.CatalogRead]),
    ).toBe(false);
    expect(service.hasEveryPermission(authContext, [])).toBe(false);
    expect(
      service.hasEveryPermission(authContext, [AuthPermission.CatalogRead]),
    ).toBe(true);
    expect(
      service.hasEveryPermission(authContext, [AuthPermission.MembersRead]),
    ).toBe(false);
  });

  it('preserves supplied staff context fields during request normalization', () => {
    expect(
      service.normalizeRequestContext({
        id: 'fallback-id',
        subjectId: 'subject-id',
        roleArea: 'staff',
        roles: [StaffRole.Admin],
        permissions: [AuthPermission.RolesManage],
        authVersion: 8,
        issuer: 'https://issuer.example',
        audience: 'library-api',
        tokenId: 'token-2',
        scope: AuthPermission.RolesManage,
      }),
    ).toEqual({
      subjectId: 'subject-id',
      roleArea: 'staff',
      roles: [StaffRole.Admin],
      permissions: [AuthPermission.RolesManage],
      authVersion: 8,
      issuer: 'https://issuer.example',
      audience: 'library-api',
      tokenId: 'token-2',
      scope: AuthPermission.RolesManage,
    });
  });

  it('reviews every staff role with its effective permissions', () => {
    expect(service.reviewStaffRoles()).toEqual([
      {
        role: StaffRole.Staff,
        permissions: [...staffRolePermissions[StaffRole.Staff]],
      },
      {
        role: StaffRole.Admin,
        permissions: [...staffRolePermissions[StaffRole.Admin]],
      },
    ]);
  });
});
