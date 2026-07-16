import { expect, test, type Page } from '@playwright/test';

test('member routes only call member-scoped me endpoints', async ({ page }) => {
  const requestedUrls: string[] = [];
  await mockMemberSession(page, requestedUrls);

  await page.goto('/member/login');
  await page.getByLabel('Login identifier').fill('M-1001');
  await page.getByLabel('Password').fill('DemoMember#2026');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/member');

  await page.getByRole('link', { name: 'Books' }).click();
  await expect(
    page.getByRole('heading', { name: 'My borrowed books' }),
  ).toBeVisible();
  await page.getByRole('link', { name: /Clean Code/i }).click();
  await expect(page.getByRole('heading', { name: 'Clean Code' })).toBeVisible();

  expect(
    requestedUrls.some((url) => /\/members\/(?!me\b)[^/?]+/.test(url)),
  ).toBe(false);
});

test('member browser direct staff route attempts do not load staff data', async ({
  page,
}) => {
  const requestedUrls: string[] = [];
  await mockMemberSession(page, requestedUrls);

  const staffRoutes = [
    '/staff',
    '/staff/books',
    '/staff/catalog',
    '/staff/membership-types',
    '/staff/members',
    '/staff/borrowings',
    '/staff/borrowings/new',
    '/staff/borrowings/overdue',
  ];

  for (const staffRoute of staffRoutes) {
    await signInAsMember(page);

    const requestStart = requestedUrls.length;
    await page.goto(staffRoute);

    await expect(page).toHaveURL(/\/(?:unauthorized|login)$/);
    expect(requestedUrls.slice(requestStart).some(isStaffBackOfficeApi)).toBe(
      false,
    );
  }
});

async function signInAsMember(page: Page) {
  await page.goto('/member/login');
  await page.getByLabel('Login identifier').fill('M-1001');
  await page.getByLabel('Password').fill('DemoMember#2026');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/member');
}

async function mockMemberSession(page: Page, requestedUrls: string[]) {
  await page.route('http://*:3000/**', async (route) => {
    const url = route.request().url();
    requestedUrls.push(url);

    if (url.endsWith('/auth/login')) {
      await route.fulfill({
        json: {
          accessToken: 'member-token',
          member: {
            id: 'member-1',
            memberNumber: 'M-1001',
            displayName: 'Jane Reader',
            membershipStatus: 'active',
            membershipTypeId: 'tier-1',
            membershipTypeName: 'Gold Member',
            membershipTypeCode: 'GOLD',
          },
        },
      });
      return;
    }

    if (url.endsWith('/members/me')) {
      await route.fulfill({
        json: {
          id: 'member-1',
          memberNumber: 'M-1001',
          displayName: 'Jane Reader',
          membershipStatus: 'active',
          membershipTypeId: 'tier-1',
          membershipTypeName: 'Gold Member',
          membershipTypeCode: 'GOLD',
          activeLoanCount: 1,
        },
      });
      return;
    }

    if (url.endsWith('/members/me/policy-status')) {
      await route.fulfill({
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
      });
      return;
    }

    if (url.includes('/members/me/borrowings/borrowing-1')) {
      await route.fulfill({
        json: borrowing(),
      });
      return;
    }

    if (url.includes('/members/me/borrowings')) {
      await route.fulfill({
        json: [borrowing()],
      });
      return;
    }

    await route.fulfill({ status: 404, json: { message: 'Not mocked' } });
  });
}

function isStaffBackOfficeApi(url: string) {
  return /\/(books|book-categories|borrowings|membership-types|staff-users)(\/|\?|$)|\/members(?!\/me\b)(\/|\?|$)/.test(
    url,
  );
}

function borrowing() {
  return {
    id: 'borrowing-1',
    memberId: 'member-1',
    bookId: 'book-1',
    bookTitle: 'Clean Code',
    bookCategoryId: 'cat-1',
    borrowedAt: '2026-06-03T00:00:00.000Z',
    dueAt: '2026-06-17T00:00:00.000Z',
    status: 'active',
    borrowedByStaffId: 'staff-1',
  };
}
