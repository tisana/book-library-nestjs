import { expect, test } from '@playwright/test';
import { loginAsStaff, mockStaffApi } from './support/library-api-mocks';

const staffViewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet landscape', width: 1024, height: 768 },
  { name: 'tablet portrait', width: 768, height: 1024 },
] as const;

for (const viewport of staffViewports) {
  test(`staff screens remain usable at ${viewport.name} ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await mockStaffApi(page);
    await loginAsStaff(page);

    await expect(
      page.getByRole('heading', { name: 'Back office dashboard' }),
    ).toBeInViewport();
    await expect(page.getByRole('link', { name: 'Borrowings' }).first()).toBeVisible();
    await expect(page.getByText('Refactoring borrowed by Olivia Overdue')).toBeVisible();

    await page.getByRole('link', { name: 'Borrowings' }).first().click();
    await expect(page.getByRole('heading', { name: 'Borrowing Management' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Member' })).toBeVisible();
    await expect(page.getByText('Jane Reader', { exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Overdue' }).first().click();
    await expect(page.getByRole('heading', { name: 'Overdue Borrowings' })).toBeVisible();
    await expect(page.getByText('Olivia Overdue', { exact: true })).toBeVisible();
  });
}
