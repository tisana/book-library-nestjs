import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl as API_BASE_URL } from '@/lib/api/client';
import { server } from '@/test/mocks/server';
import { createCatalog, listCatalog, updateCatalog, useCatalog, useCreateCatalog, useUpdateCatalog } from './catalog';

const catalog = { id: 'category-1', code: 'TECH', name: 'Technology', loanPeriodDays: 14, status: 'active' } as const;
afterEach(() => vi.restoreAllMocks());

describe('catalog API', () => {
  it('serializes catalog status and unwraps its list envelope', async () => {
    server.use(http.get(`${API_BASE_URL}/book-categories`, ({ request }) => { expect(new URL(request.url).search).toBe('?status=active'); return HttpResponse.json({ items: [catalog] }); }));
    await expect(listCatalog({ status: 'active' })).resolves.toEqual([catalog]);
  });

  it('posts and patches exact catalog bodies', async () => {
    const createInput = { code: 'TECH', name: 'Technology', loanPeriodDays: 14 };
    const updateInput = { name: 'Technology and Computing', status: 'deactivated' as const };
    server.use(
      http.post(`${API_BASE_URL}/book-categories`, async ({ request }) => { expect(await request.json()).toEqual(createInput); return HttpResponse.json(catalog, { status: 201 }); }),
      http.patch(`${API_BASE_URL}/book-categories/category-1`, async ({ request }) => { expect(await request.json()).toEqual(updateInput); return HttpResponse.json({ ...catalog, ...updateInput }); }),
    );
    await expect(createCatalog(createInput)).resolves.toEqual(catalog);
    await expect(updateCatalog('category-1', updateInput)).resolves.toEqual({ ...catalog, ...updateInput });
  });

  it('exposes catalog list and mutation hooks', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); const wrapper = ({ children }: PropsWithChildren) => createElement(QueryClientProvider, { client }, children);
    server.use(http.get(`${API_BASE_URL}/book-categories`, () => HttpResponse.json([catalog])), http.post(`${API_BASE_URL}/book-categories`, () => HttpResponse.json(catalog)), http.patch(`${API_BASE_URL}/book-categories/category-1`, () => HttpResponse.json(catalog)));
    const list = renderHook(() => useCatalog(), { wrapper }); const create = renderHook(() => useCreateCatalog(), { wrapper }); const update = renderHook(() => useUpdateCatalog('category-1'), { wrapper });
    await waitFor(() => expect(list.result.current.data).toEqual([catalog])); await expect(create.result.current.mutateAsync({ code: 'TECH', name: 'Technology', loanPeriodDays: 14 })).resolves.toEqual(catalog); await expect(update.result.current.mutateAsync({ status: 'active' })).resolves.toEqual(catalog);
  });
});
