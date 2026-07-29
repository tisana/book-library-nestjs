import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { BorrowedBooksList } from './borrowed-books-list';
import {
  NoCurrentBorrowingsState,
  QuotaAvailableState,
} from './member-empty-states';
import { QuotaStatusCard } from './quota-status-card';
import type { BorrowingView, MemberPolicyStatusView } from '@/lib/api/types';

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  );

  return {
    ...actual,
    Link: ({
      children,
      params,
    }: {
      children: ReactNode;
      params?: { borrowingId?: string };
    }) => (
      <a href={`/member/borrowings/${params?.borrowingId ?? ''}`}>{children}</a>
    ),
  };
});

const policy: MemberPolicyStatusView = {
  memberId: 'member-1',
  status: 'active',
  membershipTypeId: 'tier-1',
  maxActiveLoans: 3,
  activeLoanCount: 1,
  remainingAllowance: 2,
  eligibleByStatus: true,
  withinLimit: true,
  limitReached: false,
};

const activeBorrowing: BorrowingView = {
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

const returnedBorrowing: BorrowingView = {
  ...activeBorrowing,
  id: 'borrowing-returned',
  bookTitle: 'Already Returned',
  status: 'returned',
  returnedAt: '2026-06-16T00:00:00.000Z',
};

describe('Member home components', () => {
  it('renders quota, no-borrowings, and quota-available states', () => {
    const { rerender } = render(<QuotaStatusCard policy={policy} />);

    expect(screen.getByText('1 of 3 borrowed')).toBeInTheDocument();
    expect(screen.getByText('2 remaining')).toBeInTheDocument();

    rerender(<NoCurrentBorrowingsState />);
    expect(screen.getByText('No current borrowed books')).toBeInTheDocument();

    rerender(<QuotaAvailableState remainingAllowance={2} />);
    expect(screen.getByText('2 books available to borrow')).toBeInTheDocument();
  });

  it('renders borrowed book card titles, dates, and due status', () => {
    render(
      <BorrowedBooksList
        borrowings={[activeBorrowing]}
        now={new Date('2026-06-17T12:00:00.000Z')}
      />,
    );

    expect(
      screen.getByRole('link', { name: /Clean Code/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Borrowed Jun 3, 2026')).toBeInTheDocument();
    expect(screen.getByText('Due Jun 17, 2026')).toBeInTheDocument();
    expect(screen.getByText('Due today')).toBeInTheDocument();
  });

  it('excludes returned books from the current borrowing list', () => {
    render(
      <BorrowedBooksList
        borrowings={[activeBorrowing, returnedBorrowing]}
        now={new Date('2026-06-17T12:00:00.000Z')}
      />,
    );

    expect(screen.getByRole('link', { name: 'Clean Code' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Already Returned' })).toBeNull();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('keeps returned books when the list is explicitly used for borrowing history', () => {
    render(
      <BorrowedBooksList
        borrowings={[activeBorrowing, returnedBorrowing]}
        currentOnly={false}
        now={new Date('2026-06-17T12:00:00.000Z')}
      />,
    );

    expect(screen.getByRole('link', { name: 'Already Returned' })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it.each(['inactive', 'suspended'] as const)(
    'explains why a %s account cannot borrow',
    (status) => {
      render(
        <QuotaStatusCard
          policy={{
            ...policy,
            status,
            eligibleByStatus: false,
            remainingAllowance: 0,
            limitReached: false,
          }}
        />,
      );

      expect(screen.getByText(new RegExp(`membership is ${status}`, 'i'))).toBeInTheDocument();
    },
  );

  it('does not announce quota availability when no allowance remains', () => {
    render(<QuotaAvailableState remainingAllowance={0} />);

    expect(screen.queryByText(/available to borrow/i)).toBeNull();
  });
});
