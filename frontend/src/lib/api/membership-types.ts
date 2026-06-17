import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '@/app/query-client';
import { apiClient } from './client';
import { queryKeys } from './query-keys';
import type {
  CreateMembershipTierInput,
  ListQuery,
  MembershipTierView,
  UpdateMembershipTierInput,
} from './types';

const asArray = <T,>(value: T[] | { items: T[] }) =>
  Array.isArray(value) ? value : value.items;

export function listMembershipTypes(query: ListQuery = {}) {
  const search = new URLSearchParams();
  if (query.status) search.set('status', query.status);

  return apiClient
    .get<MembershipTierView[] | { items: MembershipTierView[] }>(
      `/membership-types?${search.toString()}`,
    )
    .then(asArray);
}

export function createMembershipType(input: CreateMembershipTierInput) {
  return apiClient.post<MembershipTierView>('/membership-types', input);
}

export function updateMembershipType(
  id: string,
  input: UpdateMembershipTierInput,
) {
  return apiClient.patch<MembershipTierView>(`/membership-types/${id}`, input);
}

export function useMembershipTypes(query: ListQuery = {}) {
  return useQuery({
    queryKey: queryKeys.staff.membershipTypes(query),
    queryFn: () => listMembershipTypes(query),
  });
}

export function useCreateMembershipType() {
  return useMutation({
    mutationFn: createMembershipType,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['staff', 'membership-types'],
      }),
  });
}

export function useUpdateMembershipType(id: string) {
  return useMutation({
    mutationFn: (input: UpdateMembershipTierInput) =>
      updateMembershipType(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['staff', 'membership-types'],
      }),
  });
}
