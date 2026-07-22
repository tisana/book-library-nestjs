import { authSession } from '@/lib/auth/session';
import { signOut, signOutAll } from '@/lib/auth/sign-out';
import { apiClient } from './client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { invalidateIdentifierConflictMutation } from './mutations';
import { queryKeys } from './query-keys';
import type {
  AuthTokenMetadata,
  CurrentAuthResponse,
  LoginResponse,
  SharedLoginRequest,
  SharedLoginResponse,
  StaffLoginRequest,
  StaffSessionUser,
  SessionUser,
  AuthIdentifierConflictView,
  AuthIdentifierOperationView,
  AuthIdentifierResolutionResult,
  ResolveAuthIdentifierConflictInput,
  PaginatedResponse,
  SecurityActivityEventView,
  SecurityActivityQuery,
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
    permissions: user.permissions ?? response.permissions ?? ['catalog:read'],
  };
}

function normalizeSharedUser(response: SharedLoginResponse): SessionUser {
  if (
    response.roleArea === 'member' ||
    ('member' in response && response.member)
  ) {
    const member = response.member;
    if (!member) {
      throw new Error('Member login did not return a member session.');
    }
    return {
      ...member,
      roleArea: 'member',
      permissions: member.permissions ??
        response.permissions ?? ['member:self:read'],
    };
  }

  return normalizeStaffUser(response);
}

export async function login(input: SharedLoginRequest) {
  const response = await apiClient.post<SharedLoginResponse>(
    '/auth/login',
    input,
    { auth: false },
  );
  const user = normalizeSharedUser(response);
  authSession.setSession(response.accessToken, user, tokenMetadata(response));
  return user;
}

export async function staffLogin(input: StaffLoginRequest) {
  const user = await login({
    identifier: input.email,
    password: input.password,
  });
  if (user.roleArea !== 'staff') {
    throw new Error('Staff login did not return a staff session.');
  }
  return user;
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
  return signOutAll();
}

export function listIdentifierConflicts() {
  return apiClient.get<AuthIdentifierConflictView[]>(
    '/auth/identifier-conflicts',
  );
}

export function resolveIdentifierConflict(
  conflictId: string,
  input: ResolveAuthIdentifierConflictInput,
) {
  return apiClient.post<AuthIdentifierResolutionResult>(
    `/auth/identifier-conflicts/${conflictId}/resolve`,
    input,
  );
}

export function getIdentifierOperation(operationId: string) {
  return apiClient.get<AuthIdentifierOperationView>(
    `/auth/identifier-operations/${operationId}`,
  );
}

export function useIdentifierConflicts() {
  return useQuery({
    queryKey: queryKeys.staff.identifierConflicts(),
    queryFn: listIdentifierConflicts,
  });
}

export function useResolveIdentifierConflict() {
  return useMutation({
    mutationFn: ({
      conflictId,
      input,
    }: {
      conflictId: string;
      input: ResolveAuthIdentifierConflictInput;
    }) => resolveIdentifierConflict(conflictId, input),
    onSuccess: (result) =>
      invalidateIdentifierConflictMutation(result.operationId),
  });
}

export function useIdentifierOperation(operationId?: string) {
  return useQuery({
    queryKey: queryKeys.staff.identifierOperation(operationId ?? ''),
    queryFn: () => getIdentifierOperation(operationId!),
    enabled: Boolean(operationId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'completed' || status === 'failed-terminal'
        ? false
        : 1_000;
    },
  });
}

export function listSecurityActivity(query: SecurityActivityQuery = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const search = params.toString();
  return apiClient.get<PaginatedResponse<SecurityActivityEventView>>(
    `/auth/security-activity${search ? `?${search}` : ''}`,
  );
}

export function useSecurityActivity(query: SecurityActivityQuery) {
  return useQuery({
    queryKey: queryKeys.staff.securityActivity(query),
    queryFn: () => listSecurityActivity(query),
  });
}
