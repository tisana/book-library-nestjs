import { expect, test } from '@playwright/test';
import {
  createPerformanceDataset,
  loginAsStaff,
  mockMemberApi,
  mockStaffApi,
} from './support/library-api-mocks';

test('staff list and detail views render useful seeded-scale content within 2 seconds', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    'Staff performance smoke targets desktop/tablet back-office layouts.',
  );

  const dataset = createPerformanceDataset();
  await mockStaffApi(page, dataset);
  await loginAsStaff(page);

  await page.getByRole('link', { name: 'Books' }).first().click();
  const listStart = Date.now();
  await expect(page.getByRole('heading', { name: 'Book Collection' })).toBeVisible();
  await expect(page.getByText('Demo Book 001')).toBeVisible();
  expect(Date.now() - listStart).toBeLessThan(2000);

  await page.getByRole('link', { name: 'Demo Book 001' }).click();
  await expect(page.getByRole('heading', { name: 'Demo Book 001' })).toBeVisible();
  await page.getByRole('link', { name: 'Books' }).first().click();
  await expect(page.getByRole('heading', { name: 'Book Collection' })).toBeVisible();

  const detailStart = Date.now();
  await page.getByRole('link', { name: 'Demo Book 001' }).click();
  await expect(page.getByRole('heading', { name: 'Demo Book 001' })).toBeVisible();
  await expect(page.getByText('BK-2001')).toBeVisible();
  expect(Date.now() - detailStart).toBeLessThan(2000);

  const borrowingStart = Date.now();
  await page.getByRole('link', { name: 'Borrowings' }).first().click();
  await expect(page.getByText('Demo Member 01', { exact: true })).toBeVisible();
  await expect(page.getByText('Demo Book 001', { exact: true })).toBeVisible();
  expect(Date.now() - borrowingStart).toBeLessThan(2000);
});

test('member home renders useful seeded-scale content within 2 seconds', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-06-17T12:00:00.000Z'));
  const dataset = createPerformanceDataset();
  await mockMemberApi(page, {
    activeLoanCount: 3,
    borrowings: dataset.borrowings.slice(0, 3),
  });

  await page.goto('/member/login');
  await page.getByLabel('Login identifier').fill('M-1001');
  await page.getByLabel('Password').fill('DemoMember#2026');

  const start = Date.now();
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/member');
  await expect(page.getByRole('heading', { name: 'Jane Reader' })).toBeVisible();
  await expect(page.getByLabel('Current borrowed books')).toContainText('Demo Book 001');
  expect(Date.now() - start).toBeLessThan(2000);
});
