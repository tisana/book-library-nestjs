import { authSession } from '@/lib/auth/session';
import { signOut } from '@/lib/auth/sign-out';
import { apiClient } from './client';
import type {
  AuthTokenMetadata,
  CurrentAuthResponse,
  LoginResponse,
  StaffLoginRequest,
  StaffSessionUser,
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

function normalizeStaffUser(response: LoginResponse<StaffSessionUser>) {
  const user = response.user ?? response.principal;

  if (!user) {
    throw new Error('Staff login did not return a staff session.');
  }

  return {
    ...user,
    roleArea: 'staff' as const,
    permissions: user.permissions ?? response.permissions,
  };
}

export async function staffLogin(input: StaffLoginRequest) {
  const response = await apiClient.post<LoginResponse<StaffSessionUser>>(
    '/auth/login',
    input,
    { auth: false },
  );
  const staffUser = normalizeStaffUser(response);

  authSession.setSession(
    response.accessToken,
    staffUser,
    tokenMetadata(response),
  );

  return staffUser;
}

export async function refreshStaffSession() {
  const response = await apiClient.post<LoginResponse<StaffSessionUser>>(
    '/auth/refresh',
    undefined,
    { auth: false },
  );
  const staffUser = normalizeStaffUser(response);

  authSession.setSession(
    response.accessToken,
    staffUser,
    tokenMetadata(response),
  );

  return staffUser;
}

export async function getCurrentAuthUser() {
  const response = await apiClient.get<CurrentAuthResponse>('/auth/me');

  if (response.user) {
    response.user = {
      ...response.user,
      roleArea: 'staff',
      permissions: response.user.permissions ?? response.permissions ?? [],
    };
  }

  if (response.member) {
    response.member = {
      ...response.member,
      roleArea: 'member',
      permissions: response.member.permissions ?? response.permissions ?? [],
    };
  }

  return response;
}

export function staffLogout() {
  return signOut('staff');
}

export async function staffLogoutAll() {
  try {
    await apiClient.post('/auth/logout-all', undefined);
  } finally {
    authSession.clear('signed-out');
  }
}
