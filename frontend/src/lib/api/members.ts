import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '@/app/query-client';
import { apiClient } from './client';
import { queryKeys } from './query-keys';
import type {
  BorrowingView,
  CreateMemberInput,
  ListQuery,
  MemberPolicyStatusView,
  MemberView,
  UpdateMemberInput,
} from './types';

const asArray = <T,>(value: T[] | { items: T[] }) =>
  Array.isArray(value) ? value : value.items;

export function listMembers(query: ListQuery = {}) {
  const search = new URLSearchParams();
  if (query.q) search.set('q', query.q);
  if (query.status) search.set('status', query.status);
  if (query.page) search.set('page', String(query.page));
  if (query.limit) search.set('limit', String(query.limit));

  return apiClient
    .get<MemberView[] | { items: MemberView[] }>(
      `/members?${search.toString()}`,
    )
    .then(asArray);
}

export function getMember(memberId: string) {
  return apiClient.get<MemberView>(`/members/${memberId}`);
}

export function getMemberPolicy(memberId: string) {
  return apiClient.get<MemberPolicyStatusView>(
    `/members/${memberId}/policy-status`,
  );
}

export function listMemberBorrowings(memberId: string) {
  return apiClient
    .get<BorrowingView[] | { items: BorrowingView[] }>(
      `/members/${memberId}/borrowings`,
    )
    .then(asArray);
}

export function createMember(input: CreateMemberInput) {
  return apiClient.post<MemberView>('/members', input);
}

export function updateMember(memberId: string, input: UpdateMemberInput) {
  return apiClient.patch<MemberView>(`/members/${memberId}`, input);
}

export function useMembers(query: ListQuery = {}) {
  return useQuery({
    queryKey: queryKeys.staff.members(query),
    queryFn: () => listMembers(query),
  });
}

export function useMember(memberId: string) {
  return useQuery({
    queryKey: queryKeys.staff.member(memberId),
    queryFn: () => getMember(memberId),
    enabled: Boolean(memberId),
  });
}

export function useMemberPolicy(memberId: string) {
  return useQuery({
    queryKey: queryKeys.staff.memberPolicy(memberId),
    queryFn: () => getMemberPolicy(memberId),
    enabled: Boolean(memberId),
  });
}

export function useMemberBorrowings(memberId: string) {
  return useQuery({
    queryKey: queryKeys.staff.memberBorrowings(memberId),
    queryFn: () => listMemberBorrowings(memberId),
    enabled: Boolean(memberId),
  });
}

export function useCreateMember() {
  return useMutation({
    mutationFn: createMember,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['staff', 'members'] }),
  });
}

export function useUpdateMember(memberId: string) {
  return useMutation({
    mutationFn: (input: UpdateMemberInput) => updateMember(memberId, input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['staff', 'members'] }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.staff.member(memberId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.staff.memberPolicy(memberId),
        }),
      ]),
  });
}
