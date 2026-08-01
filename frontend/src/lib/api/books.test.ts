import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl as API_BASE_URL } from '@/lib/api/client';
import { server } from '@/test/mocks/server';
import { createBook, getBook, listBooks, updateBook, useBook, useBooks, useCreateBook, useUpdateBook } from './books';

const book = { id: 'book-1', catalogIdentifier: 'BK-001', title: 'Refactoring', author: 'Martin Fowler', categoryId: 'category-1', totalQuantity: 2, availableQuantity: 1, status: 'active' } as const;

afterEach(() => vi.restoreAllMocks());

describe('books API', () => {
  it('serializes a filtered list and unwraps an items envelope', async () => {
    server.use(http.get(`${API_BASE_URL}/books`, ({ request }) => {
      expect(new URL(request.url).search).toBe('?q=refactoring&status=active&page=2&limit=20');
      return HttpResponse.json({ items: [book] });
    }));
    await expect(listBooks({ q: 'refactoring', status: 'active', page: 2, limit: 20 })).resolves.toEqual([book]);
  });

  it('accepts a raw-array book list', async () => {
    server.use(http.get(`${API_BASE_URL}/books`, () => HttpResponse.json([book])));
    await expect(listBooks()).resolves.toEqual([book]);
  });

  it('uses exact detail, create, and update contracts', async () => {
    const createInput = { title: 'Refactoring', author: 'Martin Fowler', isbn: '978-0201485677', coverImageUrl: 'https://example.test/cover.jpg', catalogIdentifier: 'BK-001', categoryId: 'category-1', totalQuantity: 2 };
    const updateInput = { title: 'Refactoring (2nd)', status: 'deactivated' as const, totalQuantity: 3 };
    server.use(
      http.get(`${API_BASE_URL}/books/book-1`, () => HttpResponse.json(book)),
      http.post(`${API_BASE_URL}/books`, async ({ request }) => {
        expect(await request.json()).toEqual(createInput);
        return HttpResponse.json(book, { status: 201 });
      }),
      http.patch(`${API_BASE_URL}/books/book-1`, async ({ request }) => {
        expect(await request.json()).toEqual(updateInput);
        return HttpResponse.json({ ...book, ...updateInput });
      }),
    );
    await expect(getBook('book-1')).resolves.toEqual(book);
    await expect(createBook(createInput)).resolves.toEqual(book);
    await expect(updateBook('book-1', updateInput)).resolves.toEqual({ ...book, ...updateInput });
  });

  it('exposes staff book queries and mutations through a retry-disabled client', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => createElement(QueryClientProvider, { client }, children);
    server.use(http.get(`${API_BASE_URL}/books`, () => HttpResponse.json([book])), http.get(`${API_BASE_URL}/books/book-1`, () => HttpResponse.json(book)), http.post(`${API_BASE_URL}/books`, () => HttpResponse.json(book)), http.patch(`${API_BASE_URL}/books/book-1`, () => HttpResponse.json(book)));
    const list = renderHook(() => useBooks(), { wrapper });
    const detail = renderHook(() => useBook('book-1'), { wrapper });
    const create = renderHook(() => useCreateBook(), { wrapper });
    const update = renderHook(() => useUpdateBook('book-1'), { wrapper });
    await waitFor(() => expect(list.result.current.data).toEqual([book]));
    await waitFor(() => expect(detail.result.current.data).toEqual(book));
    await expect(create.result.current.mutateAsync({ title: 'Refactoring', catalogIdentifier: 'BK-001', categoryId: 'category-1', totalQuantity: 2 })).resolves.toEqual(book);
    await expect(update.result.current.mutateAsync({ status: 'active' })).resolves.toEqual(book);
  });
});
