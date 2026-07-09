import { authSession } from '@/lib/auth/session';
import { signOut } from '@/lib/auth/sign-out';
import { apiClient } from './client';
import type {
  AuthTokenMetadata,
  CurrentAuthResponse,
  LoginResponse,
  MemberLoginRequest,
  MemberSessionUser,
} from './types';

function tokenMetadata(response: LoginResponse): AuthTokenMetadata {
  return {
    tokenType: response.tokenType,
    expiresIn: response.expiresIn,
    scope: response.scope,
    permissions: response.permissions,
    issuer: response.issuer,
    audience: response.audience,
    authVersion: response.authVersion,
  };
}

function normalizeMemberUser(response: LoginResponse<MemberSessionUser>) {
  const member = response.member ?? response.principal;

  if (!member) {
    throw new Error('Member login did not return a member session.');
  }

  return {
    ...member,
    roleArea: 'member' as const,
    permissions: member.permissions ?? response.permissions,
  };
}

export async function memberLogin(input: MemberLoginRequest) {
  const response = await apiClient.post<LoginResponse<MemberSessionUser>>(
    '/auth/member-login',
    input,
    { auth: false },
  );
  const memberUser = normalizeMemberUser(response);

  authSession.setSession(
    response.accessToken,
    memberUser,
    tokenMetadata(response),
  );

  return memberUser;
}

export async function refreshMemberSession() {
  const response = await apiClient.post<LoginResponse<MemberSessionUser>>(
    '/auth/refresh',
    undefined,
    { auth: false },
  );
  const memberUser = normalizeMemberUser(response);

  authSession.setSession(
    response.accessToken,
    memberUser,
    tokenMetadata(response),
  );

  return memberUser;
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
