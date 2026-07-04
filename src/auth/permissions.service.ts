import { Injectable } from '@nestjs/common';
import {
  AuthPermission,
  NormalizedAuthContext,
  RoleArea,
  memberRolePermissions,
  permissionsForStaffRoles,
} from '../common/enums/auth-permission.enum';
import { StaffRole } from '../common/enums/library-status.enum';
import { MemberDocument } from '../members/schemas/member.schema';
import { getMemberId } from '../members/members.service';
import { StaffUserDocument } from '../staff-users/schemas/staff-user.schema';
import { getStaffUserId } from '../staff-users/staff-users.service';

export interface RawAuthPayload {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  jti?: string;
  roleArea?: RoleArea;
  role_area?: RoleArea;
  roles?: StaffRole[];
  scope?: string;
  permissions?: AuthPermission[] | string[];
  authVersion?: number;
  auth_version?: number;
}

@Injectable()
export class PermissionsService {
  permissionsForStaffRoles(roles: readonly StaffRole[]): AuthPermission[] {
    return permissionsForStaffRoles(roles);
  }

  permissionsForMember(): AuthPermission[] {
    return [...memberRolePermissions];
  }

  permissionsFromScope(scope?: string): AuthPermission[] {
    if (!scope) {
      return [];
    }

    const knownPermissions = new Set(Object.values(AuthPermission));

    return scope
      .split(/\s+/)
      .filter((permission): permission is AuthPermission =>
        knownPermissions.has(permission as AuthPermission),
      );
  }

  buildStaffContext(
    user: Partial<StaffUserDocument>,
    payload: RawAuthPayload = {},
  ): NormalizedAuthContext {
    const roles = user.roles ?? payload.roles ?? [StaffRole.Staff];
    const permissions =
      this.permissionsFromPayload(payload) ??
      this.permissionsForStaffRoles(roles);

    return {
      subjectId: getStaffUserId(user),
      roleArea: 'staff',
      roles,
      permissions,
      authVersion: user.authVersion ?? payload.auth_version ?? 0,
      issuer: payload.iss,
      audience: payload.aud,
      tokenId: payload.jti,
      scope: permissions.join(' '),
    };
  }

  buildMemberContext(
    member: Partial<MemberDocument>,
    payload: RawAuthPayload = {},
  ): NormalizedAuthContext {
    const permissions =
      this.permissionsFromPayload(payload) ?? this.permissionsForMember();

    return {
      subjectId: getMemberId(member),
      roleArea: 'member',
      roles: ['member'],
      permissions,
      authVersion: member.authVersion ?? payload.auth_version ?? 0,
      issuer: payload.iss,
      audience: payload.aud,
      tokenId: payload.jti,
      scope: permissions.join(' '),
    };
  }

  normalizeRequestContext(
    user?: Partial<NormalizedAuthContext> & {
      authContext?: NormalizedAuthContext;
      permissions?: AuthPermission[];
      roleArea?: RoleArea;
      roles?: StaffRole[] | ['member'];
      id?: string;
    },
  ): NormalizedAuthContext | undefined {
    if (!user) {
      return undefined;
    }

    if (user.authContext) {
      return user.authContext;
    }

    if (!user.roleArea || !user.id) {
      return undefined;
    }

    return {
      subjectId: user.subjectId ?? user.id,
      roleArea: user.roleArea,
      roles: user.roles ?? (user.roleArea === 'member' ? ['member'] : []),
      permissions: user.permissions ?? [],
      authVersion: user.authVersion ?? 0,
      issuer: user.issuer,
      audience: user.audience,
      tokenId: user.tokenId,
      scope: user.scope,
    };
  }

  hasEveryPermission(
    context: NormalizedAuthContext | undefined,
    requiredPermissions: readonly AuthPermission[],
  ): boolean {
    if (!context || requiredPermissions.length === 0) {
      return false;
    }

    return requiredPermissions.every((permission) =>
      context.permissions.includes(permission),
    );
  }

  private permissionsFromPayload(
    payload: RawAuthPayload,
  ): AuthPermission[] | undefined {
    if (payload.permissions?.length) {
      return (payload.permissions as readonly string[]).filter(
        (permission): permission is AuthPermission =>
          Object.values(AuthPermission).includes(permission as AuthPermission),
      );
    }

    const scopedPermissions = this.permissionsFromScope(payload.scope);

    return scopedPermissions.length > 0 ? scopedPermissions : undefined;
  }
}
