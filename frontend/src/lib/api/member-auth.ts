import { signOut } from '@/lib/auth/sign-out';
import { login, refreshSession } from './auth';
import { apiClient } from './client';
import type {
  CurrentAuthResponse,
  MemberLoginRequest,
} from './types';

export async function memberLogin(input: MemberLoginRequest) {
  const user = await login({
    identifier: input.loginIdentifier,
    password: input.password,
  });
  if (user.roleArea !== 'member') {
    throw new Error('Member login did not return a member session.');
  }
  return user;
}

export async function refreshMemberSession() {
  const user = await refreshSession();
  if (user.roleArea !== 'member') {
    throw new Error('Member login did not return a member session.');
  }
  return user;
}

export async function getCurrentMemberAuthUser() {
  const response = await apiClient.get<CurrentAuthResponse>('/auth/me');

  if (response.member) {
    response.member = {
      ...response.member,
      roleArea: 'member',
      permissions: response.member.permissions ?? response.permissions ?? [],
    };
  }

  if (response.user) {
    response.user = {
      ...response.user,
      roleArea: 'staff',
      permissions: response.user.permissions ?? response.permissions ?? [],
    };
  }

  return response;
}

export function memberLogout() {
  return signOut('member');
}
