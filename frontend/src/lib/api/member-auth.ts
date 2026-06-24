import { authSession } from '@/lib/auth/session';
import { apiClient } from './client';
import type {
  LoginResponse,
  MemberLoginRequest,
  MemberSessionUser,
} from './types';

export async function memberLogin(input: MemberLoginRequest) {
  const response = await apiClient.post<LoginResponse<MemberSessionUser>>(
    '/auth/member-login',
    input,
    { auth: false },
  );
  const member = response.member ?? response.principal;

  if (!member) {
    throw new Error('Member login did not return a member session.');
  }

  const memberUser: MemberSessionUser = {
    ...member,
    roleArea: 'member',
  };

  authSession.setSession(response.accessToken, memberUser);

  return memberUser;
}

export function memberLogout() {
  authSession.clear('signed-out');
}
