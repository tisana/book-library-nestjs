import { authSession } from '@/lib/auth/session';
import { signOut } from '@/lib/auth/sign-out';
import { apiClient } from './client';
import type { LoginResponse, StaffLoginRequest, StaffSessionUser } from './types';

export async function staffLogin(input: StaffLoginRequest) {
  const response = await apiClient.post<LoginResponse<StaffSessionUser>>(
    '/auth/login',
    input,
    { auth: false },
  );
  const user = response.user ?? response.principal;

  if (!user) {
    throw new Error('Staff login did not return a staff session.');
  }

  const staffUser: StaffSessionUser = {
    ...user,
    roleArea: 'staff',
  };

  authSession.setSession(response.accessToken, staffUser);

  return staffUser;
}

export function staffLogout() {
  return signOut('staff');
}
