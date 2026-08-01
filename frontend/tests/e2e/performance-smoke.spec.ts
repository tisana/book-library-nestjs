import { performance } from 'node:perf_hooks';
import { expect, type Locator, test } from '@playwright/test';
import {
  createPerformanceDataset,
  loginAsStaff,
  mockMemberApi,
  mockStaffApi,
} from './support/library-api-mocks';

const PERFORMANCE_BUDGET_MS = 2_000;

async function assertUsefulContentWithinBudget(
  name: string,
  action: (timeoutMs: number) => Promise<void>,
  ready: readonly Locator[],
): Promise<void> {
  const start = performance.now();
  const deadline = start + PERFORMANCE_BUDGET_MS;

  const remainingBudget = (step: string): number => {
    const remaining = deadline - performance.now();
    if (remaining < 1) {
      throw new Error(
        `${name} exceeded ${PERFORMANCE_BUDGET_MS} ms before ${step}; elapsed=${(performance.now() - start).toFixed(1)} ms`,
      );
    }
    return Math.floor(remaining);
  };

  await action(remainingBudget('action completed'));

  for (const locator of ready) {
    await expect(locator, `${name} useful content`).toBeVisible({
      timeout: remainingBudget('all useful content was ready'),
    });
  }

  const elapsed = performance.now() - start;
  expect(
    elapsed,
    `${name} exceeded ${PERFORMANCE_BUDGET_MS} ms; elapsed=${elapsed.toFixed(1)} ms`,
  ).toBeLessThanOrEqual(PERFORMANCE_BUDGET_MS);
}

test('staff list and detail views render useful seeded-scale content within 2 seconds', async ({
  page,
}) => {
  const dataset = createPerformanceDataset();
  await mockStaffApi(page, dataset);
  await loginAsStaff(page);

  const booksLink = page.getByRole('link', { name: 'Books' }).first();
  await assertUsefulContentWithinBudget(
    'Staff books list',
    (timeoutMs) => booksLink.click({ timeout: timeoutMs }),
    [
      page.getByRole('heading', { name: 'Book Collection' }),
      page.getByText('Demo Book 001'),
    ],
  );

  const detailLink = page.getByRole('link', { name: 'Demo Book 001' });
  await assertUsefulContentWithinBudget(
    'Staff book detail',
    (timeoutMs) => detailLink.click({ timeout: timeoutMs }),
    [
      page.getByRole('heading', { name: 'Demo Book 001' }),
      page.getByText('BK-2001'),
    ],
  );

  const borrowingsLink = page.getByRole('link', { name: 'Borrowings' }).first();
  await assertUsefulContentWithinBudget(
    'Staff borrowings',
    (timeoutMs) => borrowingsLink.click({ timeout: timeoutMs }),
    [
      page.getByText('Demo Member 01', { exact: true }),
      page.getByText('Demo Book 001', { exact: true }),
    ],
  );
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

  const signInButton = page.getByRole('button', { name: /sign in/i });
  await assertUsefulContentWithinBudget(
    'Member home',
    (timeoutMs) => signInButton.click({ timeout: timeoutMs }),
    [
      page.getByRole('heading', { name: 'Jane Reader' }),
      page.getByLabel('Current borrowed books').getByText('Demo Book 001'),
    ],
  );
});
