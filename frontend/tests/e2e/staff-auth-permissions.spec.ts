import { expect, test, type Page, type Route } from '@playwright/test';

const apiUrlPattern = /http:\/\/(?:localhost|127\.0\.0\.1):3000\/.*$/;
const staffPermissions = ['catalog:read', 'borrowings:read'];
const adminPermissions = [
  ...staffPermissions,
  'staff-users:read',
  'staff-users:manage',
  'roles:read',
  'roles:manage',
  'security-events:read',
];

test('staff role cannot navigate to administrator-only areas', async ({ page }) => {
  await mockAuthBoundary(page, 'staff');
  await signIn(page, 'staff@example.test');

  await expect(page.getByRole('link', { name: 'Staff access' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Security activity' })).toHaveCount(0);
  await page.evaluate(() => {
    window.history.pushState({}, '', '/staff/users');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL(/\/unauthorized$/);
});

test('administrator role can navigate to role and security administration', async ({ page }) => {
  await mockAuthBoundary(page, 'admin');
  await signIn(page, 'admin@example.test');

  await expect(page.getByRole('link', { name: 'Staff access' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Security activity' })).toBeVisible();
  await page.getByRole('link', { name: 'Security activity' }).click();
  await expect(page).toHaveURL(/\/staff\/security-activity$/);
  await expect(page.getByRole('heading', { name: 'Security activity' })).toBeVisible();
});

test('current-session sign-out revokes refresh before local navigation completes', async ({ page }) => {
  const state = await mockAuthBoundary(page, 'staff');
  await signIn(page, 'staff@example.test');

  await page.getByRole('button', { name: /sign out/i }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  expect(state.logoutCalls).toBe(1);
  expect(state.refreshActive).toBe(false);

  const refreshStatus = await page.evaluate(async () => {
    const response = await fetch('http://localhost:3000/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    return response.status;
  });
  expect(refreshStatus).toBe(401);
  await page.goto('/staff');
  await expect(page).toHaveURL(/\/login$/);
});

async function signIn(page: Page, identifier: string) {
  await page.goto('/login');
  await page.getByLabel('Email or login identifier').fill(identifier);
  await page.getByLabel('Password').fill('Password#2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/staff');
}

async function mockAuthBoundary(page: Page, role: 'staff' | 'admin') {
  const state = { refreshActive: true, logoutCalls: 0 };
  const permissions = role === 'admin' ? adminPermissions : staffPermissions;

  await page.route(apiUrlPattern, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/auth/login') {
      return fulfillJson(route, {
        accessToken: `${role}-token`,
        tokenType: 'Bearer',
        expiresIn: 900,
        scope: permissions.join(' '),
        permissions,
        roleArea: 'staff',
        user: {
          id: `${role}-1`,
          email: `${role}@example.test`,
          displayName: role === 'admin' ? 'Library Admin' : 'Library Staff',
          roles: [role],
          permissions,
        },
      });
    }
    if (path === '/auth/logout') {
      state.logoutCalls += 1;
      state.refreshActive = false;
      return fulfillJson(route, { success: true });
    }
    if (path === '/auth/refresh') {
      return fulfillJson(
        route,
        state.refreshActive ? { accessToken: `${role}-refreshed` } : { message: 'Invalid refresh session' },
        state.refreshActive ? 200 : 401,
      );
    }
    if (path === '/auth/security-activity') {
      return fulfillJson(route, {
        items: [],
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
      });
    }
    if (path === '/staff-users') return fulfillJson(route, []);
    return fulfillJson(route, []);
  });

  return state;
}

async function fulfillJson(route: Route, json: unknown, status = 200) {
  await route.fulfill({ status, json });
}
