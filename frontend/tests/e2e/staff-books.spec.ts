import { expect, test, type Page } from '@playwright/test';

test('staff can create and update a book from the collection screen', async ({ page }) => {
  await mockStaffLogin(page);
  await page.route('http://localhost:3000/members**', (route) => route.fulfill({ json: [] }));
  await page.route('http://localhost:3000/borrowings/overdue**', (route) => route.fulfill({ json: [] }));
  await page.route('http://localhost:3000/borrowings**', (route) => route.fulfill({ json: [] }));
  await page.route('http://localhost:3000/book-categories**', (route) =>
    route.fulfill({
      json: [{ id: 'cat-1', code: 'STD', name: 'Standard', loanPeriodDays: 14, status: 'active' }],
    }),
  );
  await page.route('http://localhost:3000/books**', async (route) => {
    if (route.request().url().endsWith('/books/book-1')) {
      await route.fulfill({
        json: { id: 'book-1', title: 'Clean Code', author: 'Robert C. Martin', catalogIdentifier: 'BK-1001', categoryId: 'cat-1', totalQuantity: 3, availableQuantity: 2, status: 'active' },
      });
      return;
    }
    if (route.request().method() === 'POST') {
      await route.fulfill({
        json: { id: 'book-2', title: 'Refactoring', author: 'Martin Fowler', catalogIdentifier: 'BK-1002', categoryId: 'cat-1', totalQuantity: 1, availableQuantity: 1, status: 'active' },
      });
      return;
    }
    await route.fulfill({
      json: [{ id: 'book-1', title: 'Clean Code', author: 'Robert C. Martin', catalogIdentifier: 'BK-1001', categoryId: 'cat-1', totalQuantity: 3, availableQuantity: 2, status: 'active' }],
    });
  });

  await signIn(page);
  await page.getByRole('link', { name: 'Books' }).click();
  await expect(page.getByRole('heading', { name: 'Book Collection' })).toBeVisible();
  await page.getByRole('button', { name: /add book/i }).click();
  await page.getByLabel('Title').fill('Refactoring');
  await page.getByLabel('Author').fill('Martin Fowler');
  await page.getByLabel('Catalog identifier').fill('BK-1002');
  await page.getByLabel('Total quantity').fill('1');
  await page.getByRole('button', { name: /save book/i }).click();
  await expect(page.getByText('Book saved')).toBeVisible();

  await page.getByRole('link', { name: /Clean Code/i }).click();
  await expect(page.getByRole('heading', { name: 'Clean Code' })).toBeVisible();
  await expect(page.getByText('2 of 3 available')).toBeVisible();
});

async function mockStaffLogin(page: Page) {
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
}

async function signIn(page: Page) {
  await page.goto('/staff/login');
  await page.getByLabel('Email').fill('staff@example.test');
  await page.getByLabel('Password').fill('Password#2026');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/staff');
}
