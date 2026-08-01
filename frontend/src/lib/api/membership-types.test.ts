import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl as API_BASE_URL } from '@/lib/api/client';
import { server } from '@/test/mocks/server';
import { createMembershipType, listMembershipTypes, updateMembershipType, useCreateMembershipType, useMembershipTypes, useUpdateMembershipType } from './membership-types';

const tier = { id: 'tier-1', code: 'STANDARD', name: 'Standard', maxActiveLoans: 3, status: 'active' } as const;
afterEach(() => vi.restoreAllMocks());

describe('membership types API', () => {
  it('serializes membership status and unwraps its list envelope', async () => {
    server.use(http.get(`${API_BASE_URL}/membership-types`, ({ request }) => { expect(new URL(request.url).search).toBe('?status=active'); return HttpResponse.json({ items: [tier] }); }));
    await expect(listMembershipTypes({ status: 'active' })).resolves.toEqual([tier]);
  });

  it('posts and patches exact membership-type bodies', async () => {
    const createInput = { code: 'STANDARD', name: 'Standard', maxActiveLoans: 3 };
    const updateInput = { name: 'Standard Plus', maxActiveLoans: 4, status: 'deactivated' as const };
    server.use(
      http.post(`${API_BASE_URL}/membership-types`, async ({ request }) => { expect(await request.json()).toEqual(createInput); return HttpResponse.json(tier, { status: 201 }); }),
      http.patch(`${API_BASE_URL}/membership-types/tier-1`, async ({ request }) => { expect(await request.json()).toEqual(updateInput); return HttpResponse.json({ ...tier, ...updateInput }); }),
    );
    await expect(createMembershipType(createInput)).resolves.toEqual(tier);
    await expect(updateMembershipType('tier-1', updateInput)).resolves.toEqual({ ...tier, ...updateInput });
  });

  it('exposes membership-type list and mutation hooks', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); const wrapper = ({ children }: PropsWithChildren) => createElement(QueryClientProvider, { client }, children);
    server.use(http.get(`${API_BASE_URL}/membership-types`, () => HttpResponse.json([tier])), http.post(`${API_BASE_URL}/membership-types`, () => HttpResponse.json(tier)), http.patch(`${API_BASE_URL}/membership-types/tier-1`, () => HttpResponse.json(tier)));
    const list = renderHook(() => useMembershipTypes(), { wrapper }); const create = renderHook(() => useCreateMembershipType(), { wrapper }); const update = renderHook(() => useUpdateMembershipType('tier-1'), { wrapper });
    await waitFor(() => expect(list.result.current.data).toEqual([tier])); await expect(create.result.current.mutateAsync({ code: 'STANDARD', name: 'Standard', maxActiveLoans: 3 })).resolves.toEqual(tier); await expect(update.result.current.mutateAsync({ status: 'active' })).resolves.toEqual(tier);
  });
});
