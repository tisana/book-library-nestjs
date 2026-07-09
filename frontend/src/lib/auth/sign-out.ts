import { queryClient } from '@/app/query-client';
import { apiClient } from '@/lib/api/client';
import type { RoleArea } from '@/lib/api/types';
import { authSession } from './session';

export type SignOutRoute = '/staff/login' | '/member/login';

export async function signOut(roleArea: RoleArea): Promise<SignOutRoute> {
  try {
    await apiClient.post('/auth/logout', undefined, { auth: false });
  } catch {
    // Local sign-out must continue even if the server-side revoke call fails.
  } finally {
    authSession.clear('signed-out');
    queryClient.clear();
  }

  return roleArea === 'staff' ? '/staff/login' : '/member/login';
}
