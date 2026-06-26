import { expect, test } from '@playwright/test';
import { loginAsMember, mockMemberApi } from './support/library-api-mocks';

const memberViewports = [
  { name: 'small phone', width: 390, height: 844 },
  { name: 'large phone', width: 430, height: 932 },
] as const;

for (const viewport of memberViewports) {
  test(`member self-service remains usable at ${viewport.name} ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date('2026-06-17T12:00:00.000Z'));
    await page.setViewportSize(viewport);
    await mockMemberApi(page);
    await loginAsMember(page);

    await expect(page.getByRole('heading', { name: 'Jane Reader' })).toBeVisible();
    await expect(page.getByText('Gold Member')).toBeVisible();
    await expect(page.getByLabel('Current borrowed books')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    await page.getByRole('link', { name: 'Books' }).click();
    await expect(page.getByRole('heading', { name: 'My borrowed books' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Clean Code' })).toBeVisible();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });
}

async function hasNoHorizontalOverflow(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
}
