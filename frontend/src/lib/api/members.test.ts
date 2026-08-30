import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl as API_BASE_URL } from '@/lib/api/client';
import { server } from '@/test/mocks/server';
import { createMember, getMember, getMemberPolicy, listMemberBorrowings, listMembers, updateMember, useCreateMember, useMember, useMemberBorrowings, useMemberPolicy, useMembers, useUpdateMember } from './members';

const member = { id: 'member-1', memberNumber: 'M-1001', fullName: 'Jane Reader', email: 'jane@example.test', status: 'active', membershipTypeId: 'tier-1', activeLoanCount: 0 } as const;
const policy = { memberId: 'member-1', status: 'active', membershipTypeId: 'tier-1', maxActiveLoans: 3, activeLoanCount: 0, remainingAllowance: 3, eligibleByStatus: true, withinLimit: true, limitReached: false } as const;
const borrowing = { id: 'borrowing-1', memberId: 'member-1', bookId: 'book-1', bookCategoryId: 'category-1', borrowedAt: '2026-06-01T00:00:00.000Z', dueAt: '2026-06-15T00:00:00.000Z', status: 'active', borrowedByStaffId: 'staff-1' } as const;

afterEach(() => vi.restoreAllMocks());

describe('members API', () => {
  it('serializes a filtered member list and unwraps items', async () => {
    server.use(http.get(`${API_BASE_URL}/members`, ({ request }) => {
      expect(new URL(request.url).search).toBe('?q=jane&status=active&page=2&limit=20');
      return HttpResponse.json({ items: [member] });
    }));
    await expect(listMembers({ q: 'jane', status: 'active', page: 2, limit: 20 })).resolves.toEqual([member]);
  });

  it('uses exact detail, policy, and borrowing-history paths', async () => {
    server.use(
      http.get(`${API_BASE_URL}/members/member-1`, () => HttpResponse.json(member)),
      http.get(`${API_BASE_URL}/members/member-1/policy-status`, () => HttpResponse.json(policy)),
      http.get(`${API_BASE_URL}/members/member-1/borrowings`, () => HttpResponse.json({ items: [borrowing] })),
    );
    await expect(getMember('member-1')).resolves.toEqual(member);
    await expect(getMemberPolicy('member-1')).resolves.toEqual(policy);
    await expect(listMemberBorrowings('member-1')).resolves.toEqual([borrowing]);
  });

  it('posts and patches the exact member request bodies', async () => {
    const createInput = { memberNumber: 'M-1001', fullName: 'Jane Reader', email: 'jane@example.test', phone: '+12025550123', membershipTypeId: 'tier-1' };
    const updateInput = { fullName: 'Janet Reader', status: 'suspended' as const, activeLoanCount: 1 };
    server.use(
      http.post(`${API_BASE_URL}/members`, async ({ request }) => { expect(await request.json()).toEqual(createInput); return HttpResponse.json(member, { status: 201 }); }),
      http.patch(`${API_BASE_URL}/members/member-1`, async ({ request }) => { expect(await request.json()).toEqual(updateInput); return HttpResponse.json({ ...member, ...updateInput }); }),
    );
    await expect(createMember(createInput)).resolves.toEqual(member);
    await expect(updateMember('member-1', updateInput)).resolves.toEqual({ ...member, ...updateInput });
  });

  it('exposes staff member, policy, history, and mutation hooks', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => createElement(QueryClientProvider, { client }, children);
    server.use(http.get(`${API_BASE_URL}/members`, () => HttpResponse.json([member])), http.get(`${API_BASE_URL}/members/member-1`, () => HttpResponse.json(member)), http.get(`${API_BASE_URL}/members/member-1/policy-status`, () => HttpResponse.json(policy)), http.get(`${API_BASE_URL}/members/member-1/borrowings`, () => HttpResponse.json([borrowing])), http.post(`${API_BASE_URL}/members`, () => HttpResponse.json(member)), http.patch(`${API_BASE_URL}/members/member-1`, () => HttpResponse.json(member)));
    const list = renderHook(() => useMembers(), { wrapper }); const detail = renderHook(() => useMember('member-1'), { wrapper }); const memberPolicy = renderHook(() => useMemberPolicy('member-1'), { wrapper }); const history = renderHook(() => useMemberBorrowings('member-1'), { wrapper }); const create = renderHook(() => useCreateMember(), { wrapper }); const update = renderHook(() => useUpdateMember('member-1'), { wrapper });
    await waitFor(() => expect(list.result.current.data).toEqual([member])); await waitFor(() => expect(detail.result.current.data).toEqual(member)); await waitFor(() => expect(memberPolicy.result.current.data).toEqual(policy)); await waitFor(() => expect(history.result.current.data).toEqual([borrowing]));
    await expect(create.result.current.mutateAsync({ memberNumber: 'M-1001', fullName: 'Jane Reader', membershipTypeId: 'tier-1' })).resolves.toEqual(member);
    await expect(update.result.current.mutateAsync({ status: 'active' })).resolves.toEqual(member);
  });
});
