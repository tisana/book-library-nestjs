import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryClient } from '@/app/query-client';
import { apiBaseUrl } from '@/lib/api/client';
import { server } from '@/test/mocks/server';
import { authSession } from './session';
import { signOut, signOutAll } from './sign-out';

const user = {
  id: 'staff-1',
  email: 'staff@example.com',
  displayName: 'Staff One',
  roles: ['staff' as const],
  roleArea: 'staff' as const,
  permissions: ['catalog:read' as const],
};

describe('sign-out cleanup', () => {
  beforeEach(() => {
    authSession.clear('signed-out');
    queryClient.clear();
    localStorage.clear();
    sessionStorage.clear();
  });

  it.each([
    ['current session', signOut, '/auth/logout'],
    ['all sessions', signOutAll, '/auth/logout-all'],
  ] as const)(
    'clears memory and query state for %s',
    async (_label, action, path) => {
      const cachedClient = queryClient as QueryClient;
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      cachedClient.setQueryData(['private', 'account'], { id: 'account-1' });
      authSession.setSession('private-access-token', user);
      server.use(
        http.post(`${apiBaseUrl}${path}`, () =>
          HttpResponse.json({ success: true }),
        ),
      );

      await expect(action()).resolves.toBe('/login');
      expect(authSession.getSnapshot().accessToken).toBeUndefined();
      expect(cachedClient.getQueryData(['private', 'account'])).toBeUndefined();
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
      expect(setItem).not.toHaveBeenCalled();
    },
  );

  it('clears and returns to shared login when the revoke request fails', async () => {
    authSession.setSession('private-access-token', user);
    queryClient.setQueryData(['private'], true);
    server.use(
      http.post(`${apiBaseUrl}/auth/logout`, () => HttpResponse.error()),
    );

    await expect(signOut()).resolves.toBe('/login');
    expect(authSession.getSnapshot().accessToken).toBeUndefined();
    expect(queryClient.getQueryData(['private'])).toBeUndefined();
  });
});
