import { queryClient } from '@/app/query-client';
import type { RoleArea } from '@/lib/api/types';
import { authSession } from './session';

export type SignOutRoute = '/staff/login' | '/member/login';

export function signOut(roleArea: RoleArea): SignOutRoute {
  authSession.clear('signed-out');
  queryClient.clear();

  return roleArea === 'staff' ? '/staff/login' : '/member/login';
}
