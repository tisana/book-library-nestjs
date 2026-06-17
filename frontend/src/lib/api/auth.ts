import { authSession } from '@/lib/auth/session';
import { apiClient } from './client';
import type { LoginResponse, StaffLoginRequest, StaffSessionUser } from './types';

export async function staffLogin(input: StaffLoginRequest) {
  const response = await apiClient.post<LoginResponse<StaffSessionUser>>(
    '/auth/login',
    input,
    { auth: false },
  );
  const user = response.user ?? response.principal;

  if (!user || user.roleArea !== 'staff') {
    throw new Error('Staff login did not return a staff session.');
  }

  authSession.setSession(response.accessToken, user);

  return user;
}

export function staffLogout() {
  authSession.clear('signed-out');
}
