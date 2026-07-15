import { StaffRole } from './library-status.enum';

export enum AuthPermission {
  CatalogRead = 'catalog:read',
  CatalogManage = 'catalog:manage',
  MembersRead = 'members:read',
  MembersManage = 'members:manage',
  MembershipTypesRead = 'membership-types:read',
  MembershipTypesManage = 'membership-types:manage',
  BorrowingsRead = 'borrowings:read',
  BorrowingsManage = 'borrowings:manage',
  StaffUsersRead = 'staff-users:read',
  StaffUsersManage = 'staff-users:manage',
  RolesRead = 'roles:read',
  RolesManage = 'roles:manage',
  AuthIdentifiersRead = 'auth-identifiers:read',
  AuthIdentifiersManage = 'auth-identifiers:manage',
  SecurityEventsRead = 'security-events:read',
  MemberSelfRead = 'member:self:read',
}

export type RoleArea = 'staff' | 'member';

export interface AuthTokenClaims {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  jti: string;
  role_area: RoleArea;
  scope: string;
  permissions: AuthPermission[];
  auth_version: number;
}

export interface NormalizedAuthContext {
  subjectId: string;
  roleArea: RoleArea;
  roles: StaffRole[] | ['member'];
  permissions: AuthPermission[];
  authVersion: number;
  issuer?: string;
  audience?: string | string[];
  tokenId?: string;
  scope?: string;
}

export const staffRolePermissions: Record<
  StaffRole,
  readonly AuthPermission[]
> = {
  [StaffRole.Staff]: [
    AuthPermission.CatalogRead,
    AuthPermission.CatalogManage,
    AuthPermission.MembersRead,
    AuthPermission.MembersManage,
    AuthPermission.MembershipTypesRead,
    AuthPermission.MembershipTypesManage,
    AuthPermission.BorrowingsRead,
    AuthPermission.BorrowingsManage,
  ],
  [StaffRole.Admin]: [
    AuthPermission.CatalogRead,
    AuthPermission.CatalogManage,
    AuthPermission.MembersRead,
    AuthPermission.MembersManage,
    AuthPermission.MembershipTypesRead,
    AuthPermission.MembershipTypesManage,
    AuthPermission.BorrowingsRead,
    AuthPermission.BorrowingsManage,
    AuthPermission.StaffUsersRead,
    AuthPermission.StaffUsersManage,
    AuthPermission.RolesRead,
    AuthPermission.RolesManage,
    AuthPermission.AuthIdentifiersRead,
    AuthPermission.AuthIdentifiersManage,
    AuthPermission.SecurityEventsRead,
  ],
};

export const memberRolePermissions = [AuthPermission.MemberSelfRead] as const;

export function permissionsForStaffRoles(
  roles: readonly StaffRole[],
): AuthPermission[] {
  return Array.from(
    new Set(roles.flatMap((role) => staffRolePermissions[role] ?? [])),
  );
}
