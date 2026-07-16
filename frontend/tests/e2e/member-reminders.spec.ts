import { expect, test, type Page } from '@playwright/test';

test('member sees due reminders and quota warning on mobile', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-06-17T12:00:00.000Z'));
  await mockMemberScenario(page, {
    profileStatus: 'active',
    policyStatus: 'active',
    limitReached: true,
    activeLoanCount: 3,
    remainingAllowance: 0,
    borrowings: [
      {
        id: 'borrowing-overdue',
        bookTitle: 'Refactoring',
        dueAt: '2026-06-16T12:00:00.000Z',
        status: 'overdue',
      },
      {
        id: 'borrowing-today',
        bookTitle: 'Clean Code',
        dueAt: '2026-06-17T12:00:00.000Z',
        status: 'active',
      },
      {
        id: 'borrowing-soon',
        bookTitle: 'Domain-Driven Design',
        dueAt: '2026-06-19T12:00:00.000Z',
        status: 'active',
      },
    ],
  });

  await loginAsMember(page);

  await expect(
    page.getByRole('heading', { name: 'Member reminders' }),
  ).toBeVisible();
  const reminders = page.getByLabel('Member reminders');
  await expect(reminders.getByText('Overdue book')).toBeVisible();
  await expect(reminders.getByText('Borrowing limit reached')).toBeVisible();
  await expect(reminders.getByText('Due today', { exact: true })).toBeVisible();
  await expect(reminders.getByText('Due soon', { exact: true })).toBeVisible();
  await expect(
    reminders.getByText('Return Refactoring as soon as possible'),
  ).toBeVisible();
  await expect(
    reminders.getByText(
      'Return a current book before borrowing another title.',
    ),
  ).toBeVisible();
});

test('member sees inactive account reminder with no current borrowings', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-06-17T12:00:00.000Z'));
  await mockMemberScenario(page, {
    profileStatus: 'inactive',
    policyStatus: 'inactive',
    limitReached: false,
    activeLoanCount: 0,
    remainingAllowance: 3,
    borrowings: [],
  });

  await loginAsMember(page);

  await expect(page.getByText('Membership inactive')).toBeVisible();
  await expect(
    page.getByText(
      'Ask library staff to reactivate your membership before borrowing.',
    ),
  ).toBeVisible();
  await expect(page.getByText('No current borrowed books')).toBeVisible();
});

async function loginAsMember(page: Page) {
  await page.goto('/member/login');
  await page.getByLabel('Login identifier').fill('M-1001');
  await page.getByLabel('Password').fill('DemoMember#2026');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/member');
}

interface BorrowingScenario {
  id: string;
  bookTitle: string;
  dueAt: string;
  status: 'active' | 'overdue';
}

async function mockMemberScenario(
  page: Page,
  scenario: {
    profileStatus: 'active' | 'suspended' | 'inactive';
    policyStatus: 'active' | 'suspended' | 'inactive';
    limitReached: boolean;
    activeLoanCount: number;
    remainingAllowance: number;
    borrowings: BorrowingScenario[];
  },
) {
  await page.route('http://*:3000/auth/login', (route) =>
    route.fulfill({
      json: {
        accessToken: 'member-token',
        member: {
          id: 'member-1',
          memberNumber: 'M-1001',
          displayName: 'Jane Reader',
          email: 'jane.reader@example.test',
          membershipStatus: scenario.profileStatus,
          membershipTypeId: 'tier-1',
          membershipTypeName: 'Gold Member',
          membershipTypeCode: 'GOLD',
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
        membershipStatus: scenario.profileStatus,
        membershipTypeId: 'tier-1',
        membershipTypeName: 'Gold Member',
        membershipTypeCode: 'GOLD',
        activeLoanCount: scenario.activeLoanCount,
      },
    }),
  );
  await page.route('http://*:3000/members/me/policy-status', (route) =>
    route.fulfill({
      json: {
        memberId: 'member-1',
        status: scenario.policyStatus,
        membershipTypeId: 'tier-1',
        maxActiveLoans: 3,
        activeLoanCount: scenario.activeLoanCount,
        remainingAllowance: scenario.remainingAllowance,
        eligibleByStatus: scenario.policyStatus === 'active',
        withinLimit: !scenario.limitReached,
        limitReached: scenario.limitReached,
      },
    }),
  );
  await page.route('http://*:3000/members/me/borrowings**', (route) =>
    route.fulfill({
      json: route.request().url().includes('currentOnly=true')
        ? scenario.borrowings.map((borrowing, index) => ({
            id: borrowing.id,
            memberId: 'member-1',
            bookId: `book-${index + 1}`,
            bookTitle: borrowing.bookTitle,
            bookCategoryId: 'cat-1',
            borrowedAt: '2026-06-01T00:00:00.000Z',
            dueAt: borrowing.dueAt,
            status: borrowing.status,
            borrowedByStaffId: 'staff-1',
          }))
        : [],
    }),
  );
}
