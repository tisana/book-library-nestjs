import { redirect } from '@tanstack/react-router';
import { authSession } from './session';
import type { RoleArea } from '@/lib/api/types';

export function requireRoleArea(roleArea: RoleArea) {
  const session = authSession.getSnapshot();

  if (!session.accessToken) {
    throw redirect({ to: '/login' });
  }

  if (session.roleArea !== roleArea) {
    throw redirect({ to: '/unauthorized' });
  }

  return session;
}

export function requireStaffSession() {
  return requireRoleArea('staff');
}

export function requireMemberSession() {
  return requireRoleArea('member');
}
