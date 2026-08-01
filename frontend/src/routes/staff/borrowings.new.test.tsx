import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { apiBaseUrl } from '@/lib/api/client';
import { server } from '@/test/mocks/server';
import { StaffNewBorrowingRoute } from './borrowings.new';

function renderRoute() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={client}>
        <StaffNewBorrowingRoute />
      </QueryClientProvider>,
    ),
  };
}

const activeMember = {
  id: 'member-1', memberNumber: 'M-001', fullName: 'Member One', membershipTypeId: 'tier-1', status: 'active', activeLoanCount: 1,
};
const activeBook = {
  id: 'book-1', catalogIdentifier: 'BK-001', title: 'Available Book', author: 'Author', categoryId: 'cat-1', totalQuantity: 2, availableQuantity: 1, status: 'active',
};
const eligiblePolicy = {
  memberId: 'member-1', status: 'active', membershipTypeId: 'tier-1', maxActiveLoans: 3, activeLoanCount: 1, remainingAllowance: 2, eligibleByStatus: true, withinLimit: true, limitReached: false,
};
const createdBorrowing = {
  id: 'borrowing-1', memberId: 'member-1', bookId: 'book-1', bookCategoryId: 'cat-1', borrowedAt: '2026-06-01T00:00:00.000Z', dueAt: '2026-06-15T00:00:00.000Z', status: 'active', borrowedByStaffId: 'staff-1',
};

function useConsoleFixtures({ member = activeMember, book = activeBook, policy = eligiblePolicy, overdue = [], post }: {
  member?: typeof activeMember;
  book?: typeof activeBook;
  policy?: typeof eligiblePolicy;
  overdue?: object[];
  post?: (request: Request) => Response | Promise<Response>;
} = {}) {
  server.use(
    http.get(`${apiBaseUrl}/members`, () => HttpResponse.json([member])),
    http.get(`${apiBaseUrl}/books`, () => HttpResponse.json([book])),
    http.get(`${apiBaseUrl}/borrowings/overdue`, () => HttpResponse.json(overdue)),
    http.get(`${apiBaseUrl}/members/member-1/policy-status`, () => HttpResponse.json(policy)),
    http.post(`${apiBaseUrl}/borrowings`, async ({ request }) => post ? post(request) : HttpResponse.json(createdBorrowing, { status: 201 })),
  );
}

async function chooseEligibleValues(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(await screen.findByLabelText('Member'), 'member-1');
  await user.selectOptions(screen.getByLabelText('Book'), 'book-1');
}

describe('StaffNewBorrowingRoute', () => {
  it.each([
    ['Member is suspended', { ...activeMember, status: 'suspended' }, activeBook, eligiblePolicy, []],
    ['Member is inactive', { ...activeMember, status: 'inactive' }, activeBook, eligiblePolicy, []],
    ['Quota reached', activeMember, activeBook, { ...eligiblePolicy, activeLoanCount: 3, remainingAllowance: 0, withinLimit: false, limitReached: true }, []],
    ['Book is inactive', activeMember, { ...activeBook, status: 'deactivated' }, eligiblePolicy, []],
    ['Book has no available copies', activeMember, { ...activeBook, availableQuantity: 0 }, eligiblePolicy, []],
    ['Member has overdue borrowings', activeMember, activeBook, eligiblePolicy, [{ ...createdBorrowing, status: 'overdue' }]],
  ])('blocks a borrowing when %s', async (reason, member, book, policy, overdue) => {
    useConsoleFixtures({ member, book, policy, overdue });
    const { user } = renderRoute();
    await chooseEligibleValues(user);

    expect(await screen.findByText(reason)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record borrowing' })).toBeDisabled();
  });

  it('submits an eligible borrowing with the exact public request', async () => {
    useConsoleFixtures({
      post: async (request) => {
        expect(await request.json()).toEqual({ memberId: 'member-1', bookId: 'book-1' });
        return HttpResponse.json(createdBorrowing, { status: 201 });
      },
    });
    const { user } = renderRoute();
    await chooseEligibleValues(user);

    expect(await screen.findByText('Eligible to borrow')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Record borrowing' }));
    expect(await screen.findByText('Borrowing recorded')).toBeInTheDocument();
  });

  it('shows a safe conflict error without a success notice', async () => {
    useConsoleFixtures({
      post: () => HttpResponse.json({ message: 'Borrowing cannot be recorded right now.' }, { status: 409 }),
    });
    const { user } = renderRoute();
    await chooseEligibleValues(user);
    await user.click(await screen.findByRole('button', { name: 'Record borrowing' }));

    expect(await screen.findByText('Borrowing cannot be recorded right now.')).toBeInTheDocument();
    expect(screen.queryByText('Borrowing recorded')).toBeNull();
  });

  it('shows policy loading and console loading or unavailable states', async () => {
    server.use(
      http.get(`${apiBaseUrl}/members`, () => HttpResponse.json([activeMember])),
      http.get(`${apiBaseUrl}/books`, () => HttpResponse.json([activeBook])),
      http.get(`${apiBaseUrl}/borrowings/overdue`, () => HttpResponse.json([])),
      http.get(`${apiBaseUrl}/members/member-1/policy-status`, async () => new Promise<Response>(() => {})),
    );
    const { user, unmount } = renderRoute();
    expect(screen.getByText('Loading borrowing console')).toBeInTheDocument();
    await user.selectOptions(await screen.findByLabelText('Member'), 'member-1');
    expect(await screen.findByText('Loading policy...')).toBeInTheDocument();
    unmount();

    useConsoleFixtures({});
    server.use(http.get(`${apiBaseUrl}/members`, () => HttpResponse.json({ message: 'unavailable' }, { status: 500 })));
    renderRoute();
    expect(await screen.findByText('Borrowing console unavailable')).toBeInTheDocument();
  });
});
