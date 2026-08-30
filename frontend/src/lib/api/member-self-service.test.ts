import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { apiBaseUrl } from '@/lib/api/client';
import { server } from '@/test/mocks/server';
import {
  getMyBorrowing,
  getMyPolicyStatus,
  getMyProfile,
  listMyBorrowings,
  useMyBorrowing,
  useMyBorrowings,
  useMyPolicyStatus,
  useMyProfile,
} from './member-self-service';

const profile = {
  id: 'member-1',
  memberNumber: 'M-101',
  displayName: 'Member One',
  membershipStatus: 'active' as const,
  membershipTypeId: 'tier-1',
  activeLoanCount: 0,
};

const policy = {
  memberId: 'member-1',
  status: 'active' as const,
  membershipTypeId: 'tier-1',
  maxActiveLoans: 3,
  activeLoanCount: 0,
  remainingAllowance: 3,
  eligibleByStatus: true,
  withinLimit: true,
  limitReached: false,
};

const borrowing = {
  id: 'borrowing-1',
  memberId: 'member-1',
  bookId: 'book-1',
  bookTitle: 'Member Book',
  bookCategoryId: 'category-1',
  borrowedAt: '2026-06-01T00:00:00.000Z',
  dueAt: '2026-06-15T00:00:00.000Z',
  status: 'active' as const,
  borrowedByStaffId: 'staff-1',
};

function queryWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client }, children);
}

describe('member self-service API', () => {
  it('uses exact self-service paths and unwraps an items envelope', async () => {
    server.use(
      http.get(`${apiBaseUrl}/members/me`, ({ request }) => {
        expect(new URL(request.url).pathname).toBe('/members/me');
        return HttpResponse.json(profile);
      }),
      http.get(`${apiBaseUrl}/members/me/policy-status`, ({ request }) => {
        expect(new URL(request.url).pathname).toBe('/members/me/policy-status');
        return HttpResponse.json(policy);
      }),
      http.get(`${apiBaseUrl}/members/me/borrowings`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.pathname).toBe('/members/me/borrowings');
        expect(url.search).toBe('?currentOnly=true&limit=10');
        return HttpResponse.json({ items: [borrowing] });
      }),
      http.get(`${apiBaseUrl}/members/me/borrowings/borrowing-1`, ({ request }) => {
        expect(new URL(request.url).pathname).toBe(
          '/members/me/borrowings/borrowing-1',
        );
        return HttpResponse.json(borrowing);
      }),
    );

    await expect(getMyProfile()).resolves.toEqual(profile);
    await expect(getMyPolicyStatus()).resolves.toEqual(policy);
    await expect(
      listMyBorrowings({ currentOnly: true, limit: 10 }),
    ).resolves.toEqual([borrowing]);
    await expect(getMyBorrowing('borrowing-1')).resolves.toEqual(borrowing);
  });

  it('accepts a raw borrowing array', async () => {
    server.use(
      http.get(`${apiBaseUrl}/members/me/borrowings`, () =>
        HttpResponse.json([borrowing]),
      ),
    );

    await expect(listMyBorrowings()).resolves.toEqual([borrowing]);
  });

  it('exposes retry-disabled member queries and does not fetch an empty detail ID', async () => {
    let detailRequests = 0;
    server.use(
      http.get(`${apiBaseUrl}/members/me`, () => HttpResponse.json(profile)),
      http.get(`${apiBaseUrl}/members/me/policy-status`, () =>
        HttpResponse.json(policy),
      ),
      http.get(`${apiBaseUrl}/members/me/borrowings`, () =>
        HttpResponse.json([borrowing]),
      ),
      http.get(`${apiBaseUrl}/members/me/borrowings/borrowing-1`, () => {
        detailRequests += 1;
        return HttpResponse.json(borrowing);
      }),
    );
    const wrapper = queryWrapper();
    const profileHook = renderHook(() => useMyProfile(), { wrapper });
    const policyHook = renderHook(() => useMyPolicyStatus(), { wrapper });
    const listHook = renderHook(() => useMyBorrowings(), { wrapper });
    const detailHook = renderHook(() => useMyBorrowing('borrowing-1'), { wrapper });
    const emptyDetailHook = renderHook(() => useMyBorrowing(''), { wrapper });

    await waitFor(() => expect(profileHook.result.current.data).toEqual(profile));
    await waitFor(() => expect(policyHook.result.current.data).toEqual(policy));
    await waitFor(() => expect(listHook.result.current.data).toEqual([borrowing]));
    await waitFor(() => expect(detailHook.result.current.data).toEqual(borrowing));

    expect(detailRequests).toBe(1);
    expect(emptyDetailHook.result.current.fetchStatus).toBe('idle');
    expect(emptyDetailHook.result.current.isFetching).toBe(false);
  });
});
