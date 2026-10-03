import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, role: 'staff' | 'admin' | 'member') {
  await page.goto('/login');
  await page
    .getByLabel('Email or login identifier')
    .fill(`${role}@artifact.example.test`);
  await page.getByLabel('Password').fill('Disposable-artifact-password-2026');
  const response = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/auth/login' &&
      r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /sign in/i }).click();
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(
    new RegExp(`/${role === 'member' ? 'member' : 'staff'}$`),
  );
}

test('built app signs in, rotates real refresh credentials, serves deep links and signs out', async ({
  page,
  context,
}) => {
  await signIn(page, 'staff');
  const cookie = (await context.cookies()).find(
    (c) => c.httpOnly && c.path === '/auth',
  );
  expect(Boolean(cookie)).toBe(true);
  expect(
    await page.evaluate(
      async () =>
        (
          await fetch('/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          })
        ).status,
    ),
  ).toBe(200);
  const rotated = (await context.cookies()).find(
    (c) => c.httpOnly && c.path === '/auth',
  );
  expect(Boolean(rotated && rotated.value !== cookie?.value)).toBe(true);
  expect((await page.request.get('/staff/books')).status()).toBe(200);
  await page.getByRole('link', { name: 'Books', exact: true }).first().click();
  await expect(page.getByText('Artifact Fixture Book').first()).toBeVisible();
  expect(
    await page.evaluate(() =>
      [localStorage, sessionStorage].some((s) =>
        Object.keys(s).some((k) => /token|jwt|bearer/i.test(k)),
      ),
    ),
  ).toBe(false);
  const logout = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/auth/logout',
  );
  await page
    .getByRole('button', { name: /sign out/i })
    .first()
    .click();
  expect((await logout).status()).toBe(200);
  await expect(page).toHaveURL(/\/login$/);
  expect(
    (await context.cookies()).some((c) => c.httpOnly && c.path === '/auth'),
  ).toBe(false);
  expect(
    (
      await page.request.post('/auth/refresh', {
        headers: {
          Origin: 'http://127.0.0.1:3000',
          Cookie: `${rotated?.name}=${rotated?.value}`,
        },
      })
    ).status(),
  ).toBe(401);
  await signIn(page, 'staff');
  await page.goto('/staff/books');
  await expect(page).toHaveURL(/\/login/);
});

test('live server enforces staff permissions and member ownership', async ({
  page,
}) => {
  for (const role of ['staff', 'member'] as const) {
    await signIn(page, role);
    const statuses = await page.evaluate(
      async (paths) => {
        const refreshed = await fetch('/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        const { accessToken } = (await refreshed.json()) as {
          accessToken: string;
        };
        return Promise.all(
          paths.map(
            async (path) =>
              (
                await fetch(path, {
                  headers: { authorization: `Bearer ${accessToken}` },
                })
              ).status,
          ),
        );
      },
      role === 'staff'
        ? ['/staff-users', '/books']
        : ['/books', '/members/507f1f77bcf86cd799439024', '/members/me'],
    );
    expect(statuses).toEqual(role === 'staff' ? [403, 200] : [403, 403, 200]);
    await page
      .getByRole('button', { name: /sign out/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/login$/);
  }
  await signIn(page, 'admin');
  await page
    .getByRole('link', { name: /staff access/i })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { name: 'Staff access', exact: true }),
  ).toBeVisible();
});

test('staff records and returns a real borrowing visible to the member', async ({
  page,
}) => {
  await signIn(page, 'staff');
  await page
    .getByRole('link', { name: /new borrowing/i })
    .first()
    .click();
  await page.getByLabel('Member').selectOption('507f1f77bcf86cd799439023');
  await page.getByLabel('Book').selectOption('507f1f77bcf86cd799439025');
  await expect(page.getByText('Eligible to borrow')).toBeVisible();
  await page.getByRole('button', { name: /record borrowing/i }).click();
  await expect(page.getByText('Borrowing recorded')).toBeVisible();
  await page
    .getByRole('button', { name: /sign out/i })
    .first()
    .click();
  await signIn(page, 'member');
  await page.getByRole('link', { name: 'Books', exact: true }).first().click();
  await expect(page.getByText('Artifact Fixture Book').first()).toBeVisible();
  await page
    .getByRole('button', { name: /sign out/i })
    .first()
    .click();
  await signIn(page, 'staff');
  await page
    .getByRole('link', { name: 'Borrowings', exact: true })
    .first()
    .click();
  await page
    .getByRole('link', {
      name: 'Artifact Fixture Book borrowed by Synthetic Reader',
    })
    .click();
  await page.getByRole('button', { name: /record return/i }).click();
  await page.getByRole('button', { name: /^confirm$/i }).click();
  await expect(page.getByText('Return recorded')).toBeVisible();
});
