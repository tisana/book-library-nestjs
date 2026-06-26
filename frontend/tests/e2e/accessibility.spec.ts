import { expect, test } from '@playwright/test';
import {
  loginAsMember,
  loginAsStaff,
  mockMemberApi,
  mockStaffApi,
} from './support/library-api-mocks';

test('staff forms, route guards, dialogs, status badges, and sign-out controls are accessible', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockStaffApi(page);

  await page.goto('/staff/borrowings');
  await expect(page).toHaveURL(/\/staff\/login$/);
  await expect(page.getByRole('heading', { name: 'Staff sign in' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();

  await loginAsStaff(page);
  await expect(page.getByRole('navigation', { name: 'Staff navigation' })).toBeVisible();
  await expect(page.getByRole('button', { name: /sign out/i }).first()).toBeVisible();

  await page.getByRole('link', { name: 'New borrowing' }).first().click();
  await expect(page.getByLabel('Member')).toBeVisible();
  await expect(page.getByLabel('Book')).toBeVisible();
  await page.getByLabel('Member').selectOption('member-1');
  await page.getByLabel('Book').selectOption('book-1');
  await expect(page.getByText('Eligible to borrow')).toBeVisible();
  await expect(page.getByRole('button', { name: /record borrowing/i })).toBeEnabled();

  await page.getByRole('link', { name: 'Borrowings' }).click();
  await page.getByRole('link', { name: 'Clean Code borrowed by Jane Reader' }).click();
  await expect(page.getByText('active', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /record return/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('member forms, route guards, navigation, status badges, and sign-out controls are accessible', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-06-17T12:00:00.000Z'));
  await page.setViewportSize({ width: 390, height: 844 });
  await mockMemberApi(page);

  await page.goto('/member/borrowings');
  await expect(page).toHaveURL(/\/member\/login$/);
  await expect(page.getByRole('heading', { name: 'Member sign in' })).toBeVisible();
  await expect(page.getByLabel('Login identifier')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();

  await loginAsMember(page);
  await expect(page.getByRole('navigation', { name: 'Member navigation' })).toBeVisible();
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  const borrowedBooks = page.getByLabel('Current borrowed books');
  await expect(borrowedBooks.getByText('Due today', { exact: true })).toBeVisible();
  await expect(borrowedBooks.getByText('Overdue', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Books' }).click();
  await expect(page.getByRole('heading', { name: 'My borrowed books' })).toBeVisible();
  await page.getByRole('link', { name: 'Clean Code' }).click();
  await expect(page.getByRole('heading', { name: 'Clean Code' })).toBeVisible();
  await expect(page.getByText('Bring this book to the library desk')).toBeVisible();
});
