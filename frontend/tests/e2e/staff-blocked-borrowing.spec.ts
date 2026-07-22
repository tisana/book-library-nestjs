import { expect, test } from '@playwright/test';

test('staff sees blocked borrowing reasons before submit', async ({ page }) => {
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
  await page.route(
    'http://*:3000/members/member-limit/policy-status',
    (route) =>
      route.fulfill({
        json: {
          memberId: 'member-limit',
          status: 'active',
          membershipTypeId: 'tier-1',
          maxActiveLoans: 3,
          activeLoanCount: 3,
          remainingAllowance: 0,
          eligibleByStatus: true,
          withinLimit: false,
          limitReached: true,
        },
      }),
  );
  await page.route('http://*:3000/members**', (route) => {
    if (route.request().url().endsWith('/members/member-limit/policy-status')) {
      return route.fulfill({
        json: {
          memberId: 'member-limit',
          status: 'active',
          membershipTypeId: 'tier-1',
          maxActiveLoans: 3,
          activeLoanCount: 3,
          remainingAllowance: 0,
          eligibleByStatus: true,
          withinLimit: false,
          limitReached: true,
        },
      });
    }

    return route.fulfill({
      json: [
        {
          id: 'member-limit',
          memberNumber: 'M-1002',
          fullName: 'Max Limit',
          membershipTypeId: 'tier-1',
          status: 'active',
          activeLoanCount: 3,
        },
        {
          id: 'member-suspended',
          memberNumber: 'M-1003',
          fullName: 'Sam Suspended',
          membershipTypeId: 'tier-1',
          status: 'suspended',
          activeLoanCount: 0,
        },
      ],
    });
  });
  await page.route('http://*:3000/books**', (route) =>
    route.fulfill({
      json: [
        {
          id: 'book-unavailable',
          title: 'Unavailable Book',
          author: 'Library Demo',
          catalogIdentifier: 'BK-0',
          categoryId: 'cat-1',
          totalQuantity: 1,
          availableQuantity: 0,
          status: 'active',
        },
        {
          id: 'book-inactive',
          title: 'Inactive Book',
          author: 'Library Demo',
          catalogIdentifier: 'BK-X',
          categoryId: 'cat-1',
          totalQuantity: 1,
          availableQuantity: 1,
          status: 'deactivated',
        },
      ],
    }),
  );
  await page.route('http://*:3000/borrowings/overdue**', (route) =>
    route.fulfill({
      json: [
        {
          id: 'overdue-1',
          memberId: 'member-limit',
          bookId: 'book-unavailable',
          bookCategoryId: 'cat-1',
          borrowedAt: '2026-05-01T00:00:00.000Z',
          dueAt: '2026-05-10T00:00:00.000Z',
          status: 'overdue',
          borrowedByStaffId: 'staff-1',
        },
      ],
    }),
  );
  await page.route('http://*:3000/borrowings**', (route) =>
    route.fulfill({
      json: route.request().url().includes('/borrowings/overdue')
        ? [
            {
              id: 'overdue-1',
              memberId: 'member-limit',
              bookId: 'book-unavailable',
              bookCategoryId: 'cat-1',
              borrowedAt: '2026-05-01T00:00:00.000Z',
              dueAt: '2026-05-10T00:00:00.000Z',
              status: 'overdue',
              borrowedByStaffId: 'staff-1',
            },
          ]
        : [],
    }),
  );

  await page.goto('/staff/login');
  await page.getByLabel('Email').fill('staff@example.test');
  await page.getByLabel('Password').fill('Password#2026');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/staff');
  await page.getByRole('link', { name: /new borrowing/i }).click();
  await page.getByLabel('Member').selectOption('member-limit');
  await page.getByLabel('Book').selectOption('book-unavailable');

  await expect(page.getByText('Quota reached')).toBeVisible();
  await expect(page.getByText('Book has no available copies')).toBeVisible();
  await expect(page.getByText('Member has overdue borrowings')).toBeVisible();

  await page.getByLabel('Member').selectOption('member-suspended');
  await page.getByLabel('Book').selectOption('book-inactive');
  await expect(page.getByText('Member is suspended')).toBeVisible();
  await expect(page.getByText('Book is inactive')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /record borrowing/i }),
  ).toBeDisabled();
});
