import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCurrentAuthUser,
  login,
  refreshStaffSession,
  staffLogin,
  staffLogout,
  staffLogoutAll,
} from './auth';
import {
  getCurrentMemberAuthUser,
  memberLogin,
  refreshMemberSession,
} from './member-auth';
import { ApiClientError, apiBaseUrl, apiClient } from './client';
import type { AuthPermission, StaffRole } from './types';
import { authSession } from '@/lib/auth/session';
import { server } from '@/test/mocks/server';

const staffAuthResponse = {
  accessToken: 'staff-access-token',
  tokenType: 'Bearer',
  expiresIn: 900,
  scope: 'catalog:read staff-users:read',
  permissions: ['catalog:read', 'staff-users:read'] satisfies AuthPermission[],
  roleArea: 'staff' as const,
  user: {
    id: 'staff-1',
    email: 'admin@example.com',
    displayName: 'Library Admin',
    roles: ['admin'] satisfies StaffRole[],
    permissions: [
      'catalog:read',
      'staff-users:read',
    ] satisfies AuthPermission[],
  },
};

const memberAuthResponse = {
  accessToken: 'member-access-token',
  tokenType: 'Bearer',
  expiresIn: 900,
  scope: 'member:self:read',
  permissions: ['member:self:read'] satisfies AuthPermission[],
  roleArea: 'member' as const,
  member: {
    id: 'member-1',
    memberNumber: 'M-1001',
    displayName: 'Member One',
    email: 'member@example.com',
  },
};

describe('auth API client', () => {
  beforeEach(() => {
    authSession.clear('signed-out');
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('stores staff login token metadata and permissions in the memory session', async () => {
    server.use(
      http.post(`${apiBaseUrl}/auth/login`, () =>
        HttpResponse.json(staffAuthResponse),
      ),
    );

    const user = await staffLogin({
      email: 'admin@example.com',
      password: 'password',
    });

    expect(user.permissions).toContain('staff-users:read');
    expect(authSession.getSnapshot()).toMatchObject({
      accessToken: 'staff-access-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      scope: 'catalog:read staff-users:read',
      permissions: ['catalog:read', 'staff-users:read'],
      roleArea: 'staff',
      user: {
        roleArea: 'staff',
        permissions: ['catalog:read', 'staff-users:read'],
      },
    });
    expect(window.localStorage).toHaveLength(0);
    expect(window.sessionStorage).toHaveLength(0);
  });

  it('stores member login token metadata and member permissions in the memory session', async () => {
    server.use(
      http.post(`${apiBaseUrl}/auth/login`, () =>
        HttpResponse.json(memberAuthResponse),
      ),
    );

    const member = await memberLogin({
      loginIdentifier: 'M-1001',
      password: 'password',
    });

    expect(member.permissions).toEqual(['member:self:read']);
    expect(authSession.getSnapshot()).toMatchObject({
      accessToken: 'member-access-token',
      roleArea: 'member',
      permissions: ['member:self:read'],
      user: {
        roleArea: 'member',
        permissions: ['member:self:read'],
      },
    });
    expect(window.localStorage).toHaveLength(0);
    expect(window.sessionStorage).toHaveLength(0);
  });

  it('returns one generic API error for a failed unified login', async () => {
    server.use(
      http.post(`${apiBaseUrl}/auth/login`, () =>
        HttpResponse.json(
          {
            statusCode: 401,
            message: 'Unknown identifier member-9919@example.com',
          },
          { status: 401 },
        ),
      ),
    );

    await expect(
      login({ identifier: 'unknown@example.com', password: 'wrong-password' }),
    ).rejects.toMatchObject({ status: 401, message: 'Invalid credentials.' });
  });

  it.each([
    [403, 'member-9919@example.com is not from a trusted origin', 'Browser session request denied'],
    [429, 'member-9919@example.com exceeded its retry window', 'Authentication temporarily unavailable'],
    [500, 'member-9919@example.com database is unavailable', 'Something went wrong while contacting the API.'],
  ])(
    'returns a safe %i login error without backend details',
    async (status, backendMessage, expectedMessage) => {
      server.use(
        http.post(`${apiBaseUrl}/auth/login`, () =>
          HttpResponse.json(
            { statusCode: status, message: backendMessage },
            { status },
          ),
        ),
      );

      await expect(
        login({
          identifier: 'unknown@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toMatchObject({ status, message: expectedMessage });
    },
  );

  it('uses a safe operational message when the login network request fails', async () => {
    server.use(http.post(`${apiBaseUrl}/auth/login`, () => HttpResponse.error()));

    await expect(
      login({ identifier: 'unknown@example.com', password: 'wrong-password' }),
    ).rejects.toThrow('Something went wrong while contacting the API.');
  });

  it('rejects a staff role area paired with a member payload without storing a session', async () => {
    server.use(
      http.post(`${apiBaseUrl}/auth/login`, () =>
        HttpResponse.json({ ...memberAuthResponse, roleArea: 'staff' }),
      ),
    );

    await expect(
      staffLogin({ email: 'staff@example.com', password: 'password' }),
    ).rejects.toThrow('Something went wrong while contacting the API.');
    expect(authSession.getSnapshot()).toEqual({ reason: 'signed-out' });
  });

  it('refreshes staff and member sessions from the shared refresh endpoint', async () => {
    server.use(
      http.post(`${apiBaseUrl}/auth/refresh`, () =>
        HttpResponse.json({
          ...staffAuthResponse,
          accessToken: 'refreshed-staff-token',
        }),
      ),
    );

    await refreshStaffSession();
    expect(authSession.getSnapshot().accessToken).toBe('refreshed-staff-token');

    server.use(
      http.post(`${apiBaseUrl}/auth/refresh`, () =>
        HttpResponse.json({
          ...memberAuthResponse,
          accessToken: 'refreshed-member-token',
        }),
      ),
    );

    await refreshMemberSession();
    expect(authSession.getSnapshot()).toMatchObject({
      accessToken: 'refreshed-member-token',
      roleArea: 'member',
    });
  });

  it('calls auth/me for staff and member current-auth responses', async () => {
    server.use(
      http.get(`${apiBaseUrl}/auth/me`, () =>
        HttpResponse.json({
          roleArea: 'staff',
          user: staffAuthResponse.user,
        }),
      ),
    );

    await expect(getCurrentAuthUser()).resolves.toMatchObject({
      roleArea: 'staff',
      user: { roleArea: 'staff' },
    });

    server.use(
      http.get(`${apiBaseUrl}/auth/me`, () =>
        HttpResponse.json({
          roleArea: 'member',
          member: memberAuthResponse.member,
          permissions: ['member:self:read'],
        }),
      ),
    );

    await expect(getCurrentMemberAuthUser()).resolves.toMatchObject({
      roleArea: 'member',
      member: { roleArea: 'member' },
    });
  });

  it('clears the session exactly once for auth/me and refresh 401 responses', async () => {
    const clear = vi.spyOn(authSession, 'clear');
    authSession.setSession('staff-token', {
      ...staffAuthResponse.user,
      roleArea: 'staff',
      permissions: staffAuthResponse.permissions,
    });
    server.use(
      http.get(`${apiBaseUrl}/auth/me`, () =>
        HttpResponse.json({ message: 'Unauthorized' }, { status: 401 }),
      ),
      http.post(`${apiBaseUrl}/auth/refresh`, () =>
        HttpResponse.json({ message: 'Unauthorized' }, { status: 401 }),
      ),
    );

    await expect(getCurrentAuthUser()).rejects.toMatchObject({ status: 401 });
    expect(clear).toHaveBeenCalledTimes(1);

    authSession.setSession('replacement-token', {
      ...staffAuthResponse.user,
      roleArea: 'staff',
      permissions: staffAuthResponse.permissions,
    });
    clear.mockClear();
    await expect(refreshStaffSession()).rejects.toMatchObject({ status: 401 });
    expect(clear).toHaveBeenCalledTimes(1);
    clear.mockRestore();
  });

  it('posts logout endpoints and clears invalid sessions only on 401', async () => {
    authSession.setSession('old-token', {
      ...staffAuthResponse.user,
      roleArea: 'staff',
      permissions: staffAuthResponse.permissions,
    });

    server.use(
      http.post(`${apiBaseUrl}/auth/logout`, () =>
        HttpResponse.json({ ok: true }),
      ),
      http.post(`${apiBaseUrl}/auth/logout-all`, () =>
        HttpResponse.json({ ok: true }),
      ),
      http.get(`${apiBaseUrl}/forbidden`, () =>
        HttpResponse.json({ message: 'Forbidden' }, { status: 403 }),
      ),
      http.get(`${apiBaseUrl}/expired`, () =>
        HttpResponse.json({ message: 'Unauthorized' }, { status: 401 }),
      ),
    );

    await expect(staffLogout()).resolves.toBe('/login');
    expect(authSession.getSnapshot().accessToken).toBeUndefined();

    authSession.setSession('new-token', {
      ...staffAuthResponse.user,
      roleArea: 'staff',
      permissions: staffAuthResponse.permissions,
    });
    await staffLogoutAll();
    expect(authSession.getSnapshot().accessToken).toBeUndefined();

    authSession.setSession('forbidden-token', {
      ...staffAuthResponse.user,
      roleArea: 'staff',
      permissions: staffAuthResponse.permissions,
    });
    await expect(apiClient.get('/forbidden')).rejects.toBeInstanceOf(
      ApiClientError,
    );
    expect(authSession.getSnapshot().accessToken).toBe('forbidden-token');

    await expect(apiClient.get('/expired')).rejects.toBeInstanceOf(
      ApiClientError,
    );
    expect(authSession.getSnapshot()).toMatchObject({ reason: 'expired' });
  });
});
