import { expect, test } from '@playwright/test';

test('staff can create a borrowing and return it', async ({ page }) => {
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
  await page.route('http://*:3000/members/member-1/policy-status', (route) =>
    route.fulfill({
      json: {
        memberId: 'member-1',
        status: 'active',
        membershipTypeId: 'tier-1',
        maxActiveLoans: 3,
        activeLoanCount: 1,
        remainingAllowance: 2,
        eligibleByStatus: true,
        withinLimit: true,
        limitReached: false,
      },
    }),
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
          activeLoanCount: 1,
        },
      ],
    }),
  );
  await page.route('http://*:3000/books**', (route) =>
    route.fulfill({
      json: [
        {
          id: 'book-1',
          title: 'Clean Code',
          author: 'Robert C. Martin',
          catalogIdentifier: 'BK-1001',
          categoryId: 'cat-1',
          totalQuantity: 3,
          availableQuantity: 2,
          status: 'active',
        },
      ],
    }),
  );
  await page.route('http://*:3000/borrowings/overdue**', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('http://*:3000/borrowings/borrowing-1/return', (route) =>
    route.fulfill({
      json: {
        id: 'borrowing-1',
        memberId: 'member-1',
        memberDisplayName: 'Jane Reader',
        memberNumber: 'M-1001',
        bookId: 'book-1',
        bookTitle: 'Clean Code',
        bookCatalogIdentifier: 'BK-1001',
        bookCategoryId: 'cat-1',
        borrowedAt: '2026-06-01T00:00:00.000Z',
        dueAt: '2026-06-15T00:00:00.000Z',
        returnedAt: '2026-06-10T00:00:00.000Z',
        status: 'returned',
        borrowedByStaffId: 'staff-1',
        returnedByStaffId: 'staff-1',
      },
    }),
  );
  await page.route('http://*:3000/borrowings/borrowing-1', (route) =>
    route.fulfill({
      json: {
        id: 'borrowing-1',
        memberId: 'member-1',
        memberDisplayName: 'Jane Reader',
        memberNumber: 'M-1001',
        bookId: 'book-1',
        bookTitle: 'Clean Code',
        bookCatalogIdentifier: 'BK-1001',
        bookCategoryId: 'cat-1',
        borrowedAt: '2026-06-01T00:00:00.000Z',
        dueAt: '2026-06-15T00:00:00.000Z',
        status: 'active',
        borrowedByStaffId: 'staff-1',
      },
    }),
  );
  await page.route('http://*:3000/borrowings**', (route) => {
    const borrowing = {
      id: 'borrowing-1',
      memberId: 'member-1',
      memberDisplayName: 'Jane Reader',
      memberNumber: 'M-1001',
      bookId: 'book-1',
      bookTitle: 'Clean Code',
      bookCatalogIdentifier: 'BK-1001',
      bookCategoryId: 'cat-1',
      borrowedAt: '2026-06-01T00:00:00.000Z',
      dueAt: '2026-06-15T00:00:00.000Z',
      status: 'active',
      borrowedByStaffId: 'staff-1',
    };
    if (route.request().url().endsWith('/borrowings/borrowing-1/return')) {
      return route.fulfill({
        json: {
          ...borrowing,
          returnedAt: '2026-06-10T00:00:00.000Z',
          status: 'returned',
          returnedByStaffId: 'staff-1',
        },
      });
    }
    if (route.request().url().endsWith('/borrowings/borrowing-1')) {
      return route.fulfill({ json: borrowing });
    }
    if (route.request().url().includes('/borrowings/overdue')) {
      return route.fulfill({ json: [] });
    }
    return route.fulfill({
      json: route.request().method() === 'POST' ? borrowing : [borrowing],
    });
  });

  await page.goto('/staff/login');
  await page.getByLabel('Email').fill('staff@example.test');
  await page.getByLabel('Password').fill('Password#2026');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/staff');
  await page.getByRole('link', { name: /new borrowing/i }).first().click();
  await page.getByLabel('Member').selectOption('member-1');
  await page.getByLabel('Book').selectOption('book-1');
  await expect(page.getByText('Eligible to borrow')).toBeVisible();
  await page.getByRole('button', { name: /record borrowing/i }).click();
  await expect(page.getByText('Borrowing recorded')).toBeVisible();

  await page.getByRole('link', { name: 'Borrowings' }).click();
  await page
    .getByRole('link', { name: 'Clean Code borrowed by Jane Reader' })
    .click();
  await page.getByRole('button', { name: /record return/i }).click();
  await page.getByRole('button', { name: /^confirm$/i }).click();
  await expect(page.getByText('Return recorded')).toBeVisible();
});
