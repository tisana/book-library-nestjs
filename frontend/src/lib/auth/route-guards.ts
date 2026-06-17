import { redirect } from '@tanstack/react-router';
import { authSession } from './session';
import type { RoleArea } from '@/lib/api/types';

interface GuardContext {
  location: {
    pathname: string;
  };
}

export function requireRoleArea(roleArea: RoleArea) {
  const session = authSession.getSnapshot();

  if (!session.accessToken) {
    throw redirect({ to: roleArea === 'staff' ? '/staff/login' : '/member/login' });
  }

  if (session.roleArea !== roleArea) {
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
