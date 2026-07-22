import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryClient } from '@/app/query-client';
import { apiBaseUrl } from '@/lib/api/client';
import type { AuthPermission } from '@/lib/api/types';
import { refreshStaffSession } from '@/lib/api/auth';
import { authSession, createAuthSessionStore } from './session';
import { signOut } from './sign-out';
import { server } from '@/test/mocks/server';

const staffUser = {
  id: 'staff-1',
  email: 'staff@example.com',
  displayName: 'Staff User',
  roles: ['staff' as const],
  roleArea: 'staff' as const,
  permissions: ['catalog:read'] satisfies AuthPermission[],
};

describe('auth session store', () => {
  beforeEach(() => {
    authSession.clear('signed-out');
    localStorage.clear();
    sessionStorage.clear();
  });

  it('never writes access or refresh credentials to browser persistence or logs', () => {
    const store = createAuthSessionStore();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const indexedDbOpen = vi.fn();
    vi.stubGlobal('indexedDB', { open: indexedDbOpen });
    const consoleLog = vi
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    store.setSession('private-access-token', staffUser, {
      tokenType: 'Bearer',
      expiresIn: 900,
      permissions: ['catalog:read'],
    });

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(setItem).not.toHaveBeenCalled();
    expect(indexedDbOpen).not.toHaveBeenCalled();
    expect(JSON.stringify(queryClient.getQueryCache().getAll())).not.toContain(
      'private-access-token',
    );
    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();

    consoleLog.mockRestore();
    consoleError.mockRestore();
    vi.unstubAllGlobals();
  });

  it('keeps access tokens in memory only', () => {
    const store = createAuthSessionStore();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    store.setSession('memory-token', staffUser, {
      tokenType: 'Bearer',
      expiresIn: 900,
      scope: 'catalog:read',
      permissions: ['catalog:read'],
    });

    expect(store.getSnapshot().accessToken).toBe('memory-token');
    expect(localStorage.length).toBe(0);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('updates memory session on refresh and clears query cache during sign-out', async () => {
    const cachedClient = queryClient as QueryClient;
    cachedClient.setQueryData(['staff', 'books'], [{ id: 'book-1' }]);

    server.use(
      http.post(`${apiBaseUrl}/auth/refresh`, () =>
        HttpResponse.json({
          accessToken: 'refreshed-token',
          tokenType: 'Bearer',
          expiresIn: 900,
          scope: 'catalog:read',
          permissions: ['catalog:read'],
          user: staffUser,
        }),
      ),
      http.post(`${apiBaseUrl}/auth/logout`, () =>
        HttpResponse.json({ ok: true }),
      ),
    );

    await refreshStaffSession();
    expect(authSession.getSnapshot().accessToken).toBe('refreshed-token');
    expect(cachedClient.getQueryData(['staff', 'books'])).toBeDefined();

    await expect(signOut('staff')).resolves.toBe('/login');
    expect(authSession.getSnapshot().accessToken).toBeUndefined();
    expect(cachedClient.getQueryData(['staff', 'books'])).toBeUndefined();
  });

  it('clears local session even when server logout cannot be reached', async () => {
    const cachedClient = queryClient as QueryClient;
    cachedClient.setQueryData(
      ['member', 'borrowings'],
      [{ id: 'borrowing-1' }],
    );
    authSession.setSession('member-token', {
      id: 'member-1',
      memberNumber: 'M-1001',
      displayName: 'Member One',
      membershipStatus: 'active',
      roleArea: 'member',
      permissions: ['member:self:read'],
    });

    server.use(
      http.post(`${apiBaseUrl}/auth/logout`, () => HttpResponse.error()),
    );

    await expect(signOut('member')).resolves.toBe('/login');
    expect(authSession.getSnapshot().accessToken).toBeUndefined();
    expect(cachedClient.getQueryData(['member', 'borrowings'])).toBeUndefined();
  });
});
