import { queryClient } from '@/app/query-client';
import { apiClient } from '@/lib/api/client';
import type { RoleArea } from '@/lib/api/types';
import { authSession } from './session';

export type SignOutRoute = '/login';

export async function signOut(_roleArea?: RoleArea): Promise<SignOutRoute> {
  void _roleArea;
  try {
    await apiClient.post('/auth/logout', undefined, { auth: false });
  } catch {
    // Local sign-out must continue even if the server-side revoke call fails.
  } finally {
    authSession.clear('signed-out');
    queryClient.clear();
  }

  return '/login';
}

export async function signOutAll(): Promise<SignOutRoute> {
  try {
    await apiClient.post('/auth/logout-all', undefined);
  } catch {
    // Clearing local credentials and cached data is unconditional.
  } finally {
    authSession.clear('signed-out');
    queryClient.clear();
  }

  return '/login';
}
