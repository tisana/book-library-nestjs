import { redirect } from '@tanstack/react-router';
import { queryClient } from '@/app/query-client';
import { authSession } from './session';
import type { AuthPermission, RoleArea } from '@/lib/api/types';

interface GuardContext {
  location: {
    pathname: string;
  };
}

export function requireRoleArea(roleArea: RoleArea) {
  const session = authSession.getSnapshot();

  if (!session.accessToken) {
    throw redirect({ to: '/login' });
  }

  if (session.roleArea !== roleArea) {
    authSession.clear('switched');
    queryClient.clear();
    throw redirect({ to: '/unauthorized' });
  }

  return session;
}

export function requirePermission(
  roleArea: RoleArea,
  permission: AuthPermission,
) {
  const session = requireRoleArea(roleArea);

  if (!session.permissions?.includes(permission)) {
    queryClient.clear();
    throw redirect({ to: '/unauthorized' });
  }

  return session;
}

export function requireStaffSession(context?: GuardContext) {
  if (context?.location.pathname === '/staff/login') {
    return undefined;
  }
  return requireRoleArea('staff');
}

export function requireMemberSession(context?: GuardContext) {
  if (context?.location.pathname === '/member/login') {
    return undefined;
  }
  return requireRoleArea('member');
}

export function requireStaffPermission(permission: AuthPermission) {
  return requirePermission('staff', permission);
}

export function requireMemberPermission(permission: AuthPermission) {
  return requirePermission('member', permission);
}
