import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { apiBaseUrl } from '@/lib/api/client';
import type { BorrowingView } from '@/lib/api/types';
import { server } from '@/test/mocks/server';
import { StaffBorrowingDetailRoute } from './borrowings.$borrowingId';

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  );
  return { ...actual, useParams: () => ({ bookId: 'book-1', memberId: 'member-1', borrowingId: 'borrowing-1' }) };
});

const borrowing: BorrowingView = {
  id: 'borrowing-1', memberId: 'member-1', memberDisplayName: 'Member One', memberNumber: 'M-001',
  bookId: 'book-1', bookTitle: 'Refactoring', bookCatalogIdentifier: 'BK-001', bookCategoryId: 'cat-1',
  borrowedAt: '2026-06-01T00:00:00.000Z', dueAt: '2026-06-15T00:00:00.000Z', status: 'active', borrowedByStaffId: 'staff-1',
};

function renderRoute() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return { user: userEvent.setup(), ...render(<QueryClientProvider client={client}><StaffBorrowingDetailRoute /></QueryClientProvider>) };
}

function useBorrowingFixture(post?: (request: Request) => Response | Promise<Response>, record = borrowing) {
  server.use(
    http.get(`${apiBaseUrl}/borrowings/borrowing-1`, () => HttpResponse.json(record)),
    http.post(`${apiBaseUrl}/borrowings/borrowing-1/return`, async ({ request }) => post ? post(request) : HttpResponse.json({ ...record, status: 'returned', returnedAt: '2026-06-10T00:00:00.000Z' })),
  );
}

describe('StaffBorrowingDetailRoute', () => {
  it('shows a loading state before the borrowing record resolves', () => {
    server.use(http.get(`${apiBaseUrl}/borrowings/borrowing-1`, async () => new Promise<Response>(() => {})));
    renderRoute();
    expect(screen.getByText('Loading borrowing')).toBeInTheDocument();
  });

  it('shows a not-found state for an unavailable borrowing', async () => {
    server.use(http.get(`${apiBaseUrl}/borrowings/borrowing-1`, () => HttpResponse.json({ message: 'not found' }, { status: 404 })));
    renderRoute();
    expect(await screen.findByText('Borrowing not found')).toBeInTheDocument();
  });

  it('confirms and records an active return', async () => {
    useBorrowingFixture(async (request) => {
      expect(await request.json()).toEqual({});
      return HttpResponse.json({ ...borrowing, status: 'returned', returnedAt: '2026-06-10T00:00:00.000Z' });
    });
    const { user } = renderRoute();

    expect(await screen.findByText('Not returned')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Record return' }));
    expect(screen.getByRole('dialog', { name: undefined })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('Return recorded')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a safe conflict error without a return notice', async () => {
    useBorrowingFixture(() => HttpResponse.json({ message: 'This return cannot be recorded right now.' }, { status: 409 }));
    const { user } = renderRoute();

    await user.click(await screen.findByRole('button', { name: 'Record return' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('This return cannot be recorded right now.')).toBeInTheDocument();
    expect(screen.queryByText('Return recorded')).toBeNull();
  });

  it('locks a returned record and never posts a return', async () => {
    let returnPosts = 0;
    useBorrowingFixture(() => {
      returnPosts += 1;
      return HttpResponse.json({});
    }, { ...borrowing, status: 'returned', returnedAt: '2026-06-10T00:00:00.000Z' });
    const { user } = renderRoute();

    const recordReturn = await screen.findByRole('button', { name: 'Record return' });
    expect(recordReturn).toBeDisabled();
    await user.click(recordReturn);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(returnPosts).toBe(0);
  });
});
