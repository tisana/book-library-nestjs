import { expect, test, type Page } from '@playwright/test';

test('staff can sign out and protected staff data is cleared', async ({
  page,
}) => {
  await mockStaffApi(page);

  await page.goto('/staff/login');
  await page.getByLabel('Email').fill('staff@example.test');
  await page.getByLabel('Password').fill('Password#2026');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(
    page.getByRole('heading', { name: 'Back office dashboard' }),
  ).toBeVisible();

  await page.getByRole('button', { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('heading', { name: 'Sign in to Book Library' }),
  ).toBeVisible();

  await page.goto('/staff');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Back office dashboard')).not.toBeVisible();
});

async function mockStaffApi(page: Page) {
  await page.route('http://*:3000/auth/login', (route) =>
    route.fulfill({
      json: {
        accessToken: 'staff-token',
        user: {
          id: 'staff-1',
          email: 'staff@example.test',
          displayName: 'Staff User',
          roles: ['staff'],
          roleArea: 'staff',
        },
      },
    }),
  );
  await page.route('http://*:3000/books**', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('http://*:3000/members**', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('http://*:3000/borrowings/overdue**', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('http://*:3000/borrowings**', (route) =>
    route.fulfill({ json: [] }),
  );
}
