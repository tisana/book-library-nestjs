import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { apiBaseUrl } from '@/lib/api/client';
import { server } from '@/test/mocks/server';
import { StaffBookDetailRoute } from './books.$bookId';

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  );
  return { ...actual, useParams: () => ({ bookId: 'book-1', memberId: 'member-1', borrowingId: 'borrowing-1' }) };
});

const book = {
  id: 'book-1', catalogIdentifier: 'BK-001', title: 'Refactoring', author: 'Martin Fowler',
  categoryId: 'cat-1', totalQuantity: 2, availableQuantity: 1, status: 'active',
};

function renderRoute() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><StaffBookDetailRoute /></QueryClientProvider>);
}

describe('StaffBookDetailRoute', () => {
  it('shows a loading state before the book request resolves', () => {
    server.use(http.get(`${apiBaseUrl}/books/book-1`, async () => new Promise<Response>(() => {})));
    renderRoute();
    expect(screen.getByText('Loading book')).toBeInTheDocument();
  });

  it('shows a not-found state for an unavailable book', async () => {
    server.use(http.get(`${apiBaseUrl}/books/book-1`, () => HttpResponse.json({ message: 'not found' }, { status: 404 })));
    renderRoute();
    expect(await screen.findByText('Book not found')).toBeInTheDocument();
  });

  it('shows author, ISBN, availability, and no-cover fallbacks', async () => {
    server.use(http.get(`${apiBaseUrl}/books/book-1`, () => HttpResponse.json({
      ...book, author: undefined, isbn: undefined, coverImageUrl: undefined, availableQuantity: 0,
    })));
    renderRoute();

    expect(await screen.findByText('BK-001 by Unknown author')).toBeInTheDocument();
    expect(screen.getByText('Not recorded')).toBeInTheDocument();
    expect(screen.getByText('No copies are currently available for borrowing.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'No cover thumbnail recorded for Refactoring' })).toBeInTheDocument();
  });

  it('shows the accessible fallback when a cover fails', async () => {
    server.use(http.get(`${apiBaseUrl}/books/book-1`, () => HttpResponse.json({ ...book, coverImageUrl: '/cover.jpg', availableQuantity: 0 })));
    renderRoute();

    const cover = await screen.findByRole('img', { name: 'Cover thumbnail for Refactoring' });
    fireEvent.error(cover);
    expect(screen.getByRole('img', { name: 'No cover thumbnail recorded for Refactoring' })).toBeInTheDocument();
  });
});
