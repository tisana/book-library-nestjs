import { expect, test, type Page, type Route } from '@playwright/test';

const apiUrlPattern = /http:\/\/(?:localhost|127\.0\.0\.1):3000\/.*$/;

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function mockSharedAuth(page: Page) {
  await page.route(apiUrlPattern, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === '/auth/login') {
      const identifier = (request.postDataJSON() as { identifier?: string })
        .identifier;
      if (identifier === 'unknown@example.com') {
        return fulfillJson(
          route,
          { statusCode: 401, message: 'Invalid credentials' },
          401,
        );
      }
      if (identifier === 'M-1001') {
        return fulfillJson(route, {
          accessToken: 'member-token',
          tokenType: 'Bearer',
          expiresIn: 900,
          scope: 'member:self:read',
          permissions: ['member:self:read'],
          roleArea: 'member',
          member: {
            id: 'member-1',
            memberNumber: 'M-1001',
            displayName: 'Member One',
            membershipStatus: 'active',
            permissions: ['member:self:read'],
          },
        });
      }

      const admin = identifier === 'admin@example.com';
      const permissions = admin
        ? ['catalog:read', 'staff-users:manage', 'roles:manage']
        : ['catalog:read'];
      return fulfillJson(route, {
        accessToken: admin ? 'admin-token' : 'staff-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        scope: permissions.join(' '),
        permissions,
        roleArea: 'staff',
        user: {
          id: admin ? 'admin-1' : 'staff-1',
          email: identifier,
          displayName: admin ? 'Library Admin' : 'Staff One',
          roles: [admin ? 'admin' : 'staff'],
          permissions,
        },
      });
    }

    if (path === '/auth/logout' || path === '/auth/logout-all') {
      return fulfillJson(route, { success: true });
    }
    if (path === '/members/me') {
      return fulfillJson(route, {
        id: 'member-1',
        memberNumber: 'M-1001',
        displayName: 'Member One',
        membershipStatus: 'active',
        activeLoanCount: 0,
      });
    }
    if (path === '/members/me/policy-status') {
      return fulfillJson(route, {
        memberId: 'member-1',
        status: 'active',
        maxActiveLoans: 3,
        activeLoanCount: 0,
        remainingAllowance: 3,
        eligibleByStatus: true,
        withinLimit: true,
        limitReached: false,
      });
    }
    return fulfillJson(route, []);
  });
}

async function keyboardSignIn(page: Page, identifier: string) {
  await page.goto('/login');
  await expect(page.getByLabel('Email or login identifier')).toBeFocused();
  await page.keyboard.type(identifier);
  await page.keyboard.press('Tab');
  await page.keyboard.type('Password#2026');
  await page.keyboard.press('Enter');
}

test('staff, administrator, and member use the same keyboard-only sign-in page', async ({
  page,
}) => {
  await mockSharedAuth(page);

  for (const [identifier, landing] of [
    ['staff@example.com', '/staff'],
    ['admin@example.com', '/staff'],
    ['M-1001', '/member'],
  ] as const) {
    await keyboardSignIn(page, identifier);
    await expect(page).toHaveURL(new RegExp(`${landing}$`));
    await page
      .getByRole('button', { name: /sign out/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/login$/);
  }
});

test('legacy login URLs redirect to the shared sign-in page', async ({
  page,
}) => {
  await page.goto('/staff/login');
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('heading', { name: 'Sign in to Book Library' }),
  ).toBeVisible();

  await page.goto('/member/login');
  await expect(page).toHaveURL(/\/login$/);
});

test('generic authentication errors are announced and focused', async ({
  page,
}) => {
  await mockSharedAuth(page);
  await keyboardSignIn(page, 'unknown@example.com');

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Invalid credentials');
  await expect(alert).toBeFocused();
});
