import { useQuery } from '@tanstack/react-query';
import { millisecondsUntilNextLocalDay } from '@/app/query-client';
import { apiClient } from './client';
import { queryKeys } from './query-keys';
import type {
  BorrowingView,
  ListQuery,
  MemberPolicyStatusView,
  MemberSelfServiceProfileView,
} from './types';

const asArray = <T>(value: T[] | { items: T[] }) =>
  Array.isArray(value) ? value : value.items;

function borrowingQueryPath(query: ListQuery = {}) {
  const search = new URLSearchParams();
  if (query.status) search.set('status', query.status);
  if (query.currentOnly) search.set('currentOnly', 'true');
  if (query.page) search.set('page', String(query.page));
  if (query.limit) search.set('limit', String(query.limit));
  const queryString = search.toString();

  return `/members/me/borrowings${queryString ? `?${queryString}` : ''}`;
}

export function getMyProfile() {
  return apiClient.get<MemberSelfServiceProfileView>('/members/me');
}

export function getMyPolicyStatus() {
  return apiClient.get<MemberPolicyStatusView>('/members/me/policy-status');
}

export function listMyBorrowings(query: ListQuery = {}) {
  return apiClient
    .get<
      BorrowingView[] | { items: BorrowingView[] }
    >(borrowingQueryPath(query))
    .then(asArray);
}

export function getMyBorrowing(borrowingId: string) {
  return apiClient.get<BorrowingView>(`/members/me/borrowings/${borrowingId}`);
}

export function useMyProfile() {
  return useQuery({
    queryKey: queryKeys.memberSelf.profile,
    queryFn: getMyProfile,
  });
}

export function useMyPolicyStatus() {
  return useQuery({
    queryKey: queryKeys.memberSelf.policy,
    queryFn: getMyPolicyStatus,
  });
}

export function useMyBorrowings(query: ListQuery = {}) {
  return useQuery({
    queryKey: queryKeys.memberSelf.borrowings(query),
    queryFn: () => listMyBorrowings(query),
    refetchInterval: () => millisecondsUntilNextLocalDay(),
  });
}

export function useMyBorrowing(borrowingId: string) {
  return useQuery({
    queryKey: queryKeys.memberSelf.borrowing(borrowingId),
    queryFn: () => getMyBorrowing(borrowingId),
    enabled: Boolean(borrowingId),
  });
}
