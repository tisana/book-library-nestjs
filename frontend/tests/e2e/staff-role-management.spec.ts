import { expect, test, type Route } from '@playwright/test';

const apiUrlPattern = /http:\/\/(?:localhost|127\.0\.0\.1):3000\/.*$/;
const adminPermissions = [
  'catalog:read',
  'staff-users:read',
  'staff-users:manage',
  'roles:read',
  'roles:manage',
];

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

test('an administrator creates a staff account, assigns admin, and the new account receives access immediately', async ({
  page,
}) => {
  const startedAt = Date.now();
  const users = [
    {
      id: 'admin-1',
      email: 'admin@example.test',
      displayName: 'Library Admin',
      roles: ['admin'],
      permissions: adminPermissions,
      status: 'active',
    },
  ];

  await page.route(apiUrlPattern, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/auth/login') {
      const identifier = (request.postDataJSON() as { identifier: string }).identifier;
      const user = users.find((item) => item.email === identifier);
      if (!user) return fulfillJson(route, { message: 'Invalid credentials' }, 401);
      const permissions = user.roles.includes('admin') ? adminPermissions : ['catalog:read'];
      return fulfillJson(route, {
        accessToken: `${user.id}-token`,
        tokenType: 'Bearer',
        expiresIn: 900,
        scope: permissions.join(' '),
        permissions,
        roleArea: 'staff',
        user: { ...user, permissions },
      });
    }
    if (path === '/auth/logout') return fulfillJson(route, { success: true });
    if (path === '/auth/roles') {
      return fulfillJson(route, [
        { role: 'staff', permissions: ['catalog:read'] },
        { role: 'admin', permissions: adminPermissions },
      ]);
    }
    if (path === '/staff-users' && request.method() === 'GET') {
      return fulfillJson(route, users);
    }
    if (path === '/staff-users' && request.method() === 'POST') {
      const input = request.postDataJSON() as Record<string, unknown>;
      const created = {
        id: 'staff-2',
        email: String(input.email),
        displayName: String(input.displayName),
        roles: input.roles as string[],
        permissions: ['catalog:read'],
        status: 'active',
      };
      users.push(created);
      return fulfillJson(route, created, 201);
    }
    const updateMatch = path.match(/^\/staff-users\/(.+)$/);
    if (updateMatch && request.method() === 'PATCH') {
      const user = users.find((item) => item.id === updateMatch[1])!;
      Object.assign(user, request.postDataJSON());
      user.permissions = user.roles.includes('admin') ? adminPermissions : ['catalog:read'];
      return fulfillJson(route, user);
    }
    return fulfillJson(route, []);
  });

  await page.goto('/login');
  await page.getByLabel('Email or login identifier').fill('admin@example.test');
  await page.getByLabel('Password').fill('Password#2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/staff');
  await page.getByRole('link', { name: 'Staff access' }).click();
  await page.waitForURL('**/staff/users');

  await page.getByLabel('Display name').fill('New Staff');
  await page.getByLabel('Email').fill('new.staff@example.test');
  await page.getByLabel('Temporary password').fill('Temporary#2026');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('status')).toContainText('Staff account created');
  await expect(page.getByText('New Staff')).toBeVisible();

  await page.getByLabel('Role for New Staff').selectOption('admin');
  const row = page.getByRole('row').filter({ hasText: 'New Staff' });
  await row.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toContainText('New Staff updated');

  await page.getByRole('button', { name: /sign out/i }).first().click();
  await page.getByLabel('Email or login identifier').fill('new.staff@example.test');
  await page.getByLabel('Password').fill('Temporary#2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/staff');
  await page.getByRole('link', { name: 'Staff access' }).click();
  await page.waitForURL('**/staff/users');
  await expect(page.getByRole('heading', { name: 'Add staff account' })).toBeVisible();
  expect(Date.now() - startedAt).toBeLessThan(5 * 60 * 1000);
});
