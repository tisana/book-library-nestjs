import { expect, test, type Page } from '@playwright/test';

test('member can sign out and protected member data is cleared', async ({
  page,
}) => {
  await mockMemberApi(page);

  await page.goto('/member/login');
  await page.getByLabel('Login identifier').fill('M-1001');
  await page.getByLabel('Password').fill('DemoMember#2026');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(
    page.getByRole('heading', { name: 'Jane Reader' }),
  ).toBeVisible();

  await page.getByRole('button', { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('heading', { name: 'Sign in to Book Library' }),
  ).toBeVisible();

  await page.goto('/member');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Jane Reader')).not.toBeVisible();
});

async function mockMemberApi(page: Page) {
  await page.route('http://*:3000/auth/login', (route) =>
    route.fulfill({
      json: {
        accessToken: 'member-token',
        roleArea: 'member',
        permissions: ['member:self:read'],
        member: {
          id: 'member-1',
          memberNumber: 'M-1001',
          displayName: 'Jane Reader',
          email: 'jane.reader@example.test',
          membershipStatus: 'active',
          membershipTypeId: 'tier-1',
          membershipTypeName: 'Gold Member',
          membershipTypeCode: 'GOLD',
          permissions: ['member:self:read'],
        },
      },
    }),
  );
  await page.route('http://*:3000/members/me', (route) =>
    route.fulfill({
      json: {
        id: 'member-1',
        memberNumber: 'M-1001',
        displayName: 'Jane Reader',
        email: 'jane.reader@example.test',
        membershipStatus: 'active',
        membershipTypeId: 'tier-1',
        membershipTypeName: 'Gold Member',
        membershipTypeCode: 'GOLD',
        activeLoanCount: 0,
      },
    }),
  );
  await page.route('http://*:3000/members/me/policy-status', (route) =>
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
  await page.route('http://*:3000/members/me/borrowings**', (route) =>
    route.fulfill({ json: [] }),
  );
}
