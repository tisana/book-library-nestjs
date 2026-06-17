import { expect, test } from '@playwright/test';

test('staff can sign in and see dashboard summary', async ({ page }) => {
  await page.route('http://localhost:3000/auth/login', (route) =>
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
  await page.route('http://localhost:3000/books**', (route) =>
    route.fulfill({
      json: [
        { id: 'book-1', title: 'Clean Code', author: 'Robert C. Martin', catalogIdentifier: 'BK-1001', categoryId: 'cat-1', totalQuantity: 3, availableQuantity: 2, status: 'active' },
      ],
    }),
  );
  await page.route('http://localhost:3000/members**', (route) =>
    route.fulfill({
      json: [
        { id: 'member-1', memberNumber: 'M-1001', fullName: 'Jane Reader', membershipTypeId: 'tier-1', status: 'active', activeLoanCount: 1 },
      ],
    }),
  );
  await page.route('http://localhost:3000/borrowings/overdue**', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('http://localhost:3000/borrowings**', (route) =>
    route.fulfill({
      json: [
        { id: 'borrowing-1', memberId: 'member-1', bookId: 'book-1', bookCategoryId: 'cat-1', borrowedAt: '2026-06-01T00:00:00.000Z', dueAt: '2026-06-15T00:00:00.000Z', status: 'active', borrowedByStaffId: 'staff-1' },
      ],
    }),
  );

  await page.goto('/staff/login');
  await page.getByLabel('Email').fill('staff@example.test');
  await page.getByLabel('Password').fill('Password#2026');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.getByRole('heading', { name: 'Back office dashboard' })).toBeVisible();
  await expect(page.getByText('Active borrowings')).toBeVisible();
  await expect(page.getByText('Clean Code')).toBeVisible();
});
