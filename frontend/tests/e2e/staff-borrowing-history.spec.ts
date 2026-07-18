import { expect, test } from '@playwright/test';

test('staff member detail preserves returned and inactive borrowing history', async ({
  page,
}) => {
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
          permissions: [
            'catalog:read',
            'members:read',
            'members:manage',
            'borrowings:read',
            'borrowings:manage',
          ],
        },
      },
    }),
  );
  await page.route('http://*:3000/books**', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('http://*:3000/borrowings/overdue**', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('http://*:3000/members**', (route) =>
    route.fulfill({
      json: [
        {
          id: 'member-1',
          memberNumber: 'M-1001',
          fullName: 'Jane Reader',
          membershipTypeId: 'tier-1',
          status: 'active',
          activeLoanCount: 0,
        },
      ],
    }),
  );
  await page.route('http://*:3000/borrowings**', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('http://*:3000/members/member-1/policy-status', (route) =>
    route.fulfill({
      json: {
        memberId: 'member-1',
        status: 'active',
        membershipTypeId: 'tier-1',
        maxActiveLoans: 3,
        activeLoanCount: 0,
        remainingAllowance: 3,
        eligibleByStatus: true,
        withinLimit: true,
        limitReached: false,
      },
    }),
  );
  await page.route('http://*:3000/members/member-1/borrowings', (route) =>
    route.fulfill({
      json: [
        {
          id: 'returned-1',
          memberId: 'member-1',
          bookId: 'book-inactive',
          bookCategoryId: 'cat-inactive',
          borrowedAt: '2026-05-01T00:00:00.000Z',
          dueAt: '2026-05-10T00:00:00.000Z',
          returnedAt: '2026-05-08T00:00:00.000Z',
          status: 'returned',
          borrowedByStaffId: 'staff-1',
          returnedByStaffId: 'staff-1',
        },
      ],
    }),
  );
  await page.route('http://*:3000/members/member-1', (route) =>
    route.fulfill({
      json: {
        id: 'member-1',
        memberNumber: 'M-1001',
        fullName: 'Jane Reader',
        membershipTypeId: 'tier-1',
        status: 'active',
        activeLoanCount: 0,
      },
    }),
  );

  await page.goto('/staff/login');
  await page.getByLabel('Email').fill('staff@example.test');
  await page.getByLabel('Password').fill('Password#2026');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/staff');
  await page.getByRole('link', { name: 'Members', exact: true }).click();
  await page.getByRole('link', { name: 'Jane Reader' }).click();

  await expect(
    page.getByRole('heading', { name: 'Jane Reader' }),
  ).toBeVisible();
  await expect(page.getByText('returned-1')).toBeVisible();
  await expect(page.getByText('Returned', { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      'Historical records remain visible even when related books or catalog records are inactive.',
    ),
  ).toBeVisible();
});
