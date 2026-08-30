import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { apiBaseUrl } from '@/lib/api/client';
import { server } from '@/test/mocks/server';
import { StaffBooksRoute } from './books';

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  );
  return {
    ...actual,
    useParams: () => ({ bookId: 'book-1', memberId: 'member-1', borrowingId: 'borrowing-1' }),
    Link: ({ children }: { children: ReactNode }) => <a href="/detail">{children}</a>,
  };
});

const category = { id: 'cat-1', code: 'STD', name: 'Standard', loanPeriodDays: 14, status: 'active' };
const savedBook = {
  id: 'book-1', catalogIdentifier: 'BK-001', title: 'Refactoring', author: 'Martin Fowler',
  categoryId: 'cat-1', totalQuantity: 2, availableQuantity: 2, status: 'active',
};

function renderRoute() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    user: userEvent.setup(),
    ...render(<QueryClientProvider client={client}><StaffBooksRoute /></QueryClientProvider>),
  };
}

function useBooksFixtures(post?: (request: Request) => Response | Promise<Response>) {
  server.use(
    http.get(`${apiBaseUrl}/books`, () => HttpResponse.json([])),
    http.get(`${apiBaseUrl}/book-categories`, () => HttpResponse.json([category])),
    http.post(`${apiBaseUrl}/books`, async ({ request }) => post ? post(request) : HttpResponse.json(savedBook, { status: 201 })),
  );
}

async function completeBookForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Title'), 'Refactoring');
  await user.type(screen.getByLabelText('Catalog identifier'), 'BK-001');
  await user.type(screen.getByLabelText('Total quantity'), '2');
}

describe('StaffBooksRoute', () => {
  it('shows empty and searched-empty catalog states', async () => {
    useBooksFixtures();
    const { user } = renderRoute();

    expect(await screen.findByText('No books yet')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search books'), 'missing');
    expect(await screen.findByText('No matching books')).toBeInTheDocument();
  });

  it('saves a book and closes the add form', async () => {
    useBooksFixtures(async (request) => {
      expect(await request.json()).toEqual({
        title: 'Refactoring', author: '', isbn: '', catalogIdentifier: 'BK-001', categoryId: 'cat-1', totalQuantity: 2,
      });
      return HttpResponse.json(savedBook, { status: 201 });
    });
    const { user } = renderRoute();

    await user.click(screen.getByRole('button', { name: 'Add book' }));
    await completeBookForm(user);
    await user.click(screen.getByRole('button', { name: 'Save book' }));

    expect(await screen.findByText('Book saved')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Add book' })).toBeNull();
  });

  it('keeps the add form open and shows a safe conflict error', async () => {
    useBooksFixtures(() => HttpResponse.json(
      { message: 'A book with this catalog identifier already exists.' },
      { status: 409 },
    ));
    const { user } = renderRoute();

    await user.click(screen.getByRole('button', { name: 'Add book' }));
    await completeBookForm(user);
    await user.click(screen.getByRole('button', { name: 'Save book' }));

    expect(await screen.findByText('A book with this catalog identifier already exists.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add book' })).toBeInTheDocument();
    expect(screen.queryByText('Book saved')).toBeNull();
  });
});
