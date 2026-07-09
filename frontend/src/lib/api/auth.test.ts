import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getCurrentAuthUser,
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
  });

  it('stores member login token metadata and member permissions in the memory session', async () => {
    server.use(
      http.post(`${apiBaseUrl}/auth/member-login`, () =>
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

    await expect(staffLogout()).resolves.toBe('/staff/login');
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
