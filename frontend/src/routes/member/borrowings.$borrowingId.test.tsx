import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { apiBaseUrl } from '@/lib/api/client';
import { formatLocalDate } from '@/lib/dates/due-status';
import { server } from '@/test/mocks/server';
import { MemberBorrowingDetailRoute } from './borrowings.$borrowingId';

vi.mock('@tanstack/react-router', async () => ({
  ...(await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  )),
  useParams: () => ({ borrowingId: 'borrowing-1' }),
  Link: ({ children }: { children: ReactNode }) => (
    <a href="/member/borrowings">{children}</a>
  ),
}));

const activeBorrowing = {
  id: 'borrowing-1',
  memberId: 'member-1',
  bookId: 'book-1',
  bookCategoryId: 'category-1',
  borrowedAt: '2026-06-01T00:00:00.000Z',
  dueAt: '2099-06-15T00:00:00.000Z',
  status: 'active' as const,
  borrowedByStaffId: 'staff-1',
};

const returnedBorrowing = {
  ...activeBorrowing,
  bookTitle: 'Returned Member Book',
  status: 'returned' as const,
  returnedAt: '2026-06-10T00:00:00.000Z',
};

function renderWithClient(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe('MemberBorrowingDetailRoute', () => {
  it('shows a loading state before the private borrowing resolves', () => {
    server.use(
      http.get(`${apiBaseUrl}/members/me/borrowings/borrowing-1`, async () =>
        new Promise<Response>(() => {}),
      ),
    );

    renderWithClient(<MemberBorrowingDetailRoute />);

    expect(screen.getByText('Loading borrowed book')).toBeInTheDocument();
  });

  it('shows a private not-found state with safe server failure copy', async () => {
    server.use(
      http.get(`${apiBaseUrl}/members/me/borrowings/borrowing-1`, () =>
        HttpResponse.json({ message: 'Borrowing #42 belongs to someone else' }, { status: 404 }),
      ),
    );

    renderWithClient(<MemberBorrowingDetailRoute />);

    expect(await screen.findByText('Borrowing unavailable')).toBeInTheDocument();
    expect(
      screen.getByText('This record was not found for your member account.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Borrowing #42 belongs to someone else'),
    ).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to books' })).toHaveAttribute(
      'href',
      '/member/borrowings',
    );
  });

  it('shows active borrowing title fallback, book dates, and statuses without returned copy', async () => {
    server.use(
      http.get(`${apiBaseUrl}/members/me/borrowings/borrowing-1`, () =>
        HttpResponse.json(activeBorrowing),
      ),
    );

    renderWithClient(<MemberBorrowingDetailRoute />);

    expect(await screen.findByRole('heading', { name: 'Book book-1' })).toBeInTheDocument();
    expect(screen.getByText(formatLocalDate(activeBorrowing.borrowedAt))).toBeInTheDocument();
    expect(screen.getByText(formatLocalDate(activeBorrowing.dueAt))).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.queryByText('Returned')).toBeNull();
  });

  it('shows the returned state and returned date', async () => {
    server.use(
      http.get(`${apiBaseUrl}/members/me/borrowings/borrowing-1`, () =>
        HttpResponse.json(returnedBorrowing),
      ),
    );

    renderWithClient(<MemberBorrowingDetailRoute />);

    expect(
      await screen.findByRole('heading', { name: 'Returned Member Book' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Returned')).not.toHaveLength(0);
    expect(
      screen.getByText(formatLocalDate(returnedBorrowing.returnedAt)),
    ).toBeInTheDocument();
  });
});
