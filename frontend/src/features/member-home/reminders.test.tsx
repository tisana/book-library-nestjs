import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { deriveMemberReminders } from './reminders';
import { RemindersPanel } from './reminders-panel';
import type {
  BorrowingView,
  MemberPolicyStatusView,
  MemberSelfServiceProfileView,
} from '@/lib/api/types';

const now = new Date('2026-06-17T12:00:00.000Z');

const profile: MemberSelfServiceProfileView = {
  id: 'member-1',
  memberNumber: 'M-1001',
  displayName: 'Jane Reader',
  email: 'jane.reader@example.test',
  membershipStatus: 'active',
  membershipTypeId: 'tier-1',
  membershipTypeName: 'Gold Member',
  activeLoanCount: 3,
};

const policy: MemberPolicyStatusView = {
  memberId: 'member-1',
  status: 'active',
  membershipTypeId: 'tier-1',
  maxActiveLoans: 3,
  activeLoanCount: 3,
  remainingAllowance: 0,
  eligibleByStatus: true,
  withinLimit: false,
  limitReached: true,
};

const borrowings: BorrowingView[] = [
  {
    id: 'borrowing-overdue',
    memberId: 'member-1',
    bookId: 'book-1',
    bookTitle: 'Refactoring',
    bookCategoryId: 'cat-1',
    borrowedAt: '2026-06-01T00:00:00.000Z',
    dueAt: '2026-06-16T12:00:00.000Z',
    status: 'overdue',
    borrowedByStaffId: 'staff-1',
  },
  {
    id: 'borrowing-today',
    memberId: 'member-1',
    bookId: 'book-2',
    bookTitle: 'Clean Code',
    bookCategoryId: 'cat-1',
    borrowedAt: '2026-06-03T00:00:00.000Z',
    dueAt: '2026-06-17T12:00:00.000Z',
    status: 'active',
    borrowedByStaffId: 'staff-1',
  },
  {
    id: 'borrowing-soon',
    memberId: 'member-1',
    bookId: 'book-3',
    bookTitle: 'Domain-Driven Design',
    bookCategoryId: 'cat-1',
    borrowedAt: '2026-06-10T00:00:00.000Z',
    dueAt: '2026-06-19T12:00:00.000Z',
    status: 'active',
    borrowedByStaffId: 'staff-1',
  },
  {
    id: 'borrowing-returned',
    memberId: 'member-1',
    bookId: 'book-4',
    bookTitle: 'Returned Book',
    bookCategoryId: 'cat-1',
    borrowedAt: '2026-06-01T00:00:00.000Z',
    dueAt: '2026-06-10T12:00:00.000Z',
    returnedAt: '2026-06-11T12:00:00.000Z',
    status: 'returned',
    borrowedByStaffId: 'staff-1',
    returnedByStaffId: 'staff-1',
  },
];

describe('member reminders', () => {
  it('derives ordered reminders with severity and actionable copy', () => {
    const reminders = deriveMemberReminders({
      profile,
      policy,
      borrowings,
      now,
    });

    expect(reminders.map((reminder) => reminder.type)).toEqual([
      'overdue',
      'quota-reached',
      'due-today',
      'due-soon',
    ]);
    expect(reminders[0]).toMatchObject({
      severity: 'danger',
      title: 'Overdue book',
      message: 'Return Refactoring as soon as possible or contact library staff.',
      borrowingId: 'borrowing-overdue',
    });
    expect(reminders[1]).toMatchObject({
      severity: 'warning',
      title: 'Borrowing limit reached',
      message: 'Return a current book before borrowing another title.',
    });
  });

  it('includes suspended and inactive account reminders ahead of lower-priority notices', () => {
    const reminders = deriveMemberReminders({
      profile: { ...profile, membershipStatus: 'inactive' },
      policy: {
        ...policy,
        status: 'inactive',
        eligibleByStatus: false,
        limitReached: false,
      },
      borrowings: [borrowings[2]],
      now,
    });

    expect(reminders.map((reminder) => reminder.type)).toEqual([
      'inactive',
      'due-soon',
    ]);
    expect(reminders[0]).toMatchObject({
      severity: 'danger',
      title: 'Membership inactive',
      message: 'Ask library staff to reactivate your membership before borrowing.',
    });
  });

  it('renders reminder badges and hides returned borrowing reminders', () => {
    render(
      <RemindersPanel
        reminders={deriveMemberReminders({
          profile,
          policy,
          borrowings,
          now,
        })}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Member reminders' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Overdue book')).toBeInTheDocument();
    expect(screen.getByText('Due today')).toBeInTheDocument();
    expect(screen.getByText('Due soon')).toBeInTheDocument();
    expect(
      screen.getByText('Clean Code is due today. Return it or renew with staff.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Returned Book')).not.toBeInTheDocument();
  });
});
