import { expect, test, type Page } from '@playwright/test';

test('member can sign in on mobile and see borrowing status', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-06-17T12:00:00.000Z'));
  await mockMemberSelfService(page);

  await page.goto('/member/login');
  await page.getByLabel('Login identifier').fill('M-1001');
  await page.getByLabel('Password').fill('DemoMember#2026');
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.waitForURL('**/member');
  await expect(
    page.getByRole('heading', { name: 'Jane Reader' }),
  ).toBeVisible();
  await expect(page.getByText('Gold Member')).toBeVisible();
  await expect(page.getByText('1 of 3 borrowed')).toBeVisible();
  await expect(page.getByText('2 remaining')).toBeVisible();
  await expect(page.getByText('Clean Code')).toBeVisible();
  await expect(page.getByText('Due today')).toBeVisible();
  await expect(page.getByText('Refactoring')).toBeVisible();
  await expect(page.getByText('Overdue')).toBeVisible();
});

async function mockMemberSelfService(page: Page) {
  await page.route('http://localhost:3000/auth/member-login', (route) =>
    route.fulfill({
      json: {
        accessToken: 'member-token',
        member: {
          id: 'member-1',
          memberNumber: 'M-1001',
          displayName: 'Jane Reader',
          email: 'jane.reader@example.test',
          membershipStatus: 'active',
          membershipTypeId: 'tier-1',
          membershipTypeName: 'Gold Member',
          membershipTypeCode: 'GOLD',
        },
      },
    }),
  );
  await page.route('http://localhost:3000/members/me', (route) =>
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
        activeLoanCount: 1,
      },
    }),
  );
  await page.route('http://localhost:3000/members/me/policy-status', (route) =>
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
  await page.route('http://localhost:3000/members/me/borrowings**', (route) =>
    route.fulfill({
      json: route.request().url().includes('currentOnly=true')
        ? [
            {
              id: 'borrowing-1',
              memberId: 'member-1',
              bookId: 'book-1',
              bookTitle: 'Clean Code',
              bookCategoryId: 'cat-1',
              borrowedAt: '2026-06-03T00:00:00.000Z',
              dueAt: '2026-06-17T12:00:00.000Z',
              status: 'active',
              borrowedByStaffId: 'staff-1',
            },
            {
              id: 'borrowing-2',
              memberId: 'member-1',
              bookId: 'book-2',
              bookTitle: 'Refactoring',
              bookCategoryId: 'cat-1',
              borrowedAt: '2026-06-01T00:00:00.000Z',
              dueAt: '2026-06-16T12:00:00.000Z',
              status: 'overdue',
              borrowedByStaffId: 'staff-1',
            },
          ]
        : [],
    }),
  );
}
