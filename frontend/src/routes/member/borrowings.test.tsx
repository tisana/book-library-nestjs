import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { apiBaseUrl } from '@/lib/api/client';
import { server } from '@/test/mocks/server';
import { MemberBorrowingsRoute } from './borrowings';

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  );
  return {
    ...actual,
    Link: ({ children }: { children: ReactNode }) => <a href="/member/borrowings/id">{children}</a>,
  };
});

function renderRoute() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={client}>
      <MemberBorrowingsRoute />
    </QueryClientProvider>,
  );
  return { ...result, client };
}

afterEach(() => {
  // The route's data is scoped to a new client for every test.
});

const returnedRecord = {
  id: 'returned-1', memberId: 'member-1', bookId: 'book-1', bookTitle: 'Returned History',
  bookCategoryId: 'cat-1', borrowedAt: '2026-06-01T00:00:00.000Z', dueAt: '2026-06-15T00:00:00.000Z',
  returnedAt: '2026-06-10T00:00:00.000Z', status: 'returned', borrowedByStaffId: 'staff-1',
};

describe('MemberBorrowingsRoute', () => {
  it('shows returned books in the current and recent borrowing history', async () => {
    server.use(http.get(`${apiBaseUrl}/members/me/borrowings`, () => HttpResponse.json([returnedRecord])));
    renderRoute();

    expect(await screen.findByRole('heading', { name: 'Borrowing history' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Borrowing history' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Returned History' })).toBeInTheDocument();
    expect(screen.getByText('Returned')).toBeInTheDocument();
  });

  it('offers a visible retry after an API failure', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    server.use(http.get(`${apiBaseUrl}/members/me/borrowings`, () => {
      attempts += 1;
      return attempts === 1
        ? HttpResponse.json({ message: 'hidden failure' }, { status: 500 })
        : HttpResponse.json([returnedRecord]);
    }));
    renderRoute();

    expect(await screen.findByText('Borrowing list unavailable')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('link', { name: 'Returned History' })).toBeInTheDocument();
    expect(attempts).toBe(2);
  });
});
