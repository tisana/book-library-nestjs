import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl as API_BASE_URL } from '@/lib/api/client';
import { server } from '@/test/mocks/server';
import { createBorrowing, getBorrowing, listBorrowings, listOverdueBorrowings, returnBorrowing, useBorrowing, useBorrowings, useCreateBorrowing, useOverdueBorrowings, useReturnBorrowing } from './borrowings';

const borrowing = { id: 'borrowing-1', memberId: 'member-1', bookId: 'book-1', bookCategoryId: 'category-1', bookTitle: 'Refactoring', borrowedAt: '2026-06-01T00:00:00.000Z', dueAt: '2026-06-15T00:00:00.000Z', status: 'active', borrowedByStaffId: 'staff-1' } as const;

afterEach(() => vi.restoreAllMocks());

describe('borrowings API', () => {
  it('serializes filtered borrowings and unwraps items', async () => {
    server.use(http.get(`${API_BASE_URL}/borrowings`, ({ request }) => {
      expect(new URL(request.url).search).toBe('?status=active&page=2&limit=20');
      return HttpResponse.json({ items: [borrowing] });
    }));
    await expect(listBorrowings({ status: 'active', page: 2, limit: 20 })).resolves.toEqual([borrowing]);
  });

  it('uses the overdue endpoint and accepts its raw array', async () => {
    server.use(http.get(`${API_BASE_URL}/borrowings/overdue`, ({ request }) => {
      expect(new URL(request.url).search).toBe('?status=overdue&limit=10');
      return HttpResponse.json([borrowing]);
    }));
    await expect(listOverdueBorrowings({ status: 'overdue', limit: 10 })).resolves.toEqual([borrowing]);
  });

  it('uses exact detail, creation, and default return contracts', async () => {
    const createInput = { memberId: 'member-1', bookId: 'book-1' };
    server.use(
      http.get(`${API_BASE_URL}/borrowings/borrowing-1`, () => HttpResponse.json(borrowing)),
      http.post(`${API_BASE_URL}/borrowings`, async ({ request }) => { expect(await request.json()).toEqual(createInput); return HttpResponse.json(borrowing, { status: 201 }); }),
      http.post(`${API_BASE_URL}/borrowings/borrowing-1/return`, async ({ request }) => { expect(await request.json()).toEqual({}); return HttpResponse.json({ ...borrowing, status: 'returned' }); }),
    );
    await expect(getBorrowing('borrowing-1')).resolves.toEqual(borrowing);
    await expect(createBorrowing(createInput)).resolves.toEqual(borrowing);
    await expect(returnBorrowing('borrowing-1')).resolves.toEqual({ ...borrowing, status: 'returned' });
  });

  it('posts an explicit returned-at body', async () => {
    const input = { returnedAt: '2026-06-10T00:00:00.000Z' };
    server.use(http.post(`${API_BASE_URL}/borrowings/borrowing-1/return`, async ({ request }) => { expect(await request.json()).toEqual(input); return HttpResponse.json({ ...borrowing, ...input, status: 'returned' }); }));
    await expect(returnBorrowing('borrowing-1', input)).resolves.toEqual({ ...borrowing, ...input, status: 'returned' });
  });

  it('exposes staff borrowing queries and mutations through public hooks', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => createElement(QueryClientProvider, { client }, children);
    server.use(http.get(`${API_BASE_URL}/borrowings`, () => HttpResponse.json([borrowing])), http.get(`${API_BASE_URL}/borrowings/overdue`, () => HttpResponse.json([borrowing])), http.get(`${API_BASE_URL}/borrowings/borrowing-1`, () => HttpResponse.json(borrowing)), http.post(`${API_BASE_URL}/borrowings`, () => HttpResponse.json(borrowing)), http.post(`${API_BASE_URL}/borrowings/borrowing-1/return`, () => HttpResponse.json({ ...borrowing, status: 'returned' })));
    const list = renderHook(() => useBorrowings(), { wrapper }); const overdue = renderHook(() => useOverdueBorrowings(), { wrapper }); const detail = renderHook(() => useBorrowing('borrowing-1'), { wrapper }); const create = renderHook(() => useCreateBorrowing(), { wrapper }); const returned = renderHook(() => useReturnBorrowing('borrowing-1'), { wrapper });
    await waitFor(() => expect(list.result.current.data).toEqual([borrowing])); await waitFor(() => expect(overdue.result.current.data).toEqual([borrowing])); await waitFor(() => expect(detail.result.current.data).toEqual(borrowing));
    await expect(create.result.current.mutateAsync({ memberId: 'member-1', bookId: 'book-1' })).resolves.toEqual(borrowing);
    await expect(returned.result.current.mutateAsync()).resolves.toEqual({ ...borrowing, status: 'returned' });
  });
});
