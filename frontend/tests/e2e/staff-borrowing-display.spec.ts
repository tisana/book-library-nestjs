import { expect, test, type Page } from '@playwright/test';

const overdueBorrowing = {
  id: 'borrow-overdue-1',
  memberId: 'member-internal-1',
  memberDisplayName: 'Olivia Overdue',
  memberNumber: 'M-1004',
  bookId: 'book-internal-1',
  bookTitle: 'Refactoring',
  bookCatalogIdentifier: 'BK-1003',
  bookCategoryId: 'cat-1',
  borrowedAt: '2026-06-01T00:00:00.000Z',
  dueAt: '2026-06-15T00:00:00.000Z',
  status: 'overdue',
  borrowedByStaffId: 'staff-1',
};

const activeBorrowing = {
  ...overdueBorrowing,
  id: 'borrow-active-1',
  memberDisplayName: 'Jane Reader',
  memberNumber: 'M-1001',
  bookTitle: 'Clean Code',
  bookCatalogIdentifier: 'BK-1001',
  dueAt: '2026-06-29T00:00:00.000Z',
  status: 'active',
};

test('staff borrowing screens show human-readable member and book labels', async ({
  page,
}) => {
  await mockStaffApi(page);

  await page.goto('/staff/login');
  await page.getByLabel('Email').fill('staff@example.test');
  await page.getByLabel('Password').fill('Password#2026');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(
    page.getByText('Refactoring borrowed by Olivia Overdue'),
  ).toBeVisible();
  await expect(page.getByText('M-1004')).toBeVisible();
  await expect(page.getByText(/M-1004 .* BK-1003/)).toBeVisible();

  await page.getByRole('link', { name: 'Borrowings' }).click();
  await expect(
    page.getByRole('columnheader', { name: 'Member' }),
  ).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Book' })).toBeVisible();
  await expect(page.getByText('Jane Reader', { exact: true })).toBeVisible();
  await expect(page.getByText('Clean Code', { exact: true })).toBeVisible();
  await expect(page.getByText('member-internal-1')).not.toBeVisible();
  await expect(page.getByText('book-internal-1')).not.toBeVisible();

  await page.getByRole('link', { name: 'Overdue', exact: true }).click();
  await expect(page.getByText('Olivia Overdue', { exact: true })).toBeVisible();
  await expect(page.getByText('Refactoring', { exact: true })).toBeVisible();
  await expect(page.getByText('member-internal-1')).not.toBeVisible();
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
    route.fulfill({
      json: [
        {
          id: 'book-internal-1',
          title: 'Refactoring',
          author: 'Martin Fowler',
          catalogIdentifier: 'BK-1003',
          categoryId: 'cat-1',
          totalQuantity: 1,
          availableQuantity: 0,
          status: 'active',
        },
      ],
    }),
  );
  await page.route('http://*:3000/members**', (route) =>
    route.fulfill({
      json: [
        {
          id: 'member-internal-1',
          memberNumber: 'M-1004',
          fullName: 'Olivia Overdue',
          membershipTypeId: 'tier-1',
          status: 'active',
          activeLoanCount: 1,
        },
      ],
    }),
  );
  await page.route('http://*:3000/borrowings/overdue**', (route) =>
    route.fulfill({ json: [overdueBorrowing] }),
  );
  await page.route('http://*:3000/borrowings**', (route) =>
    route.fulfill({ json: [activeBorrowing, overdueBorrowing] }),
  );
}
