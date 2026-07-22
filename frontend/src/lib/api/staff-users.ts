import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import { invalidateStaffUserMutation } from './mutations';
import { queryKeys } from './query-keys';
import type {
  CreateStaffUserInput,
  ListQuery,
  RolePermissionReview,
  StaffUserView,
  UpdateStaffUserInput,
} from './types';

function asArray<T>(value: T[] | { items: T[] }): T[] {
  return Array.isArray(value) ? value : value.items;
}

export function listStaffUsers(query: ListQuery = {}) {
  const search = new URLSearchParams();
  if (query.status) search.set('status', query.status);
  if (query.page) search.set('page', String(query.page));
  if (query.limit) search.set('limit', String(query.limit));
  return apiClient
    .get<StaffUserView[] | { items: StaffUserView[] }>(
      `/staff-users?${search.toString()}`,
    )
    .then(asArray);
}

export function getRoleReview() {
  return apiClient.get<RolePermissionReview[]>('/auth/roles');
}

export function createStaffUser(input: CreateStaffUserInput) {
  return apiClient.post<StaffUserView>('/staff-users', input);
}

export function updateStaffUser(
  staffUserId: string,
  input: UpdateStaffUserInput,
) {
  return apiClient.patch<StaffUserView>(`/staff-users/${staffUserId}`, input);
}

export function useStaffUsers(query: ListQuery = {}) {
  return useQuery({
    queryKey: queryKeys.staff.staffUsers(query),
    queryFn: () => listStaffUsers(query),
  });
}

export function useRoleReview() {
  return useQuery({
    queryKey: queryKeys.staff.roleReview,
    queryFn: getRoleReview,
  });
}

export function useCreateStaffUser() {
  return useMutation({
    mutationFn: createStaffUser,
    onSuccess: invalidateStaffUserMutation,
  });
}

export function useUpdateStaffUser() {
  return useMutation({
    mutationFn: ({
      staffUserId,
      input,
    }: {
      staffUserId: string;
      input: UpdateStaffUserInput;
    }) => updateStaffUser(staffUserId, input),
    onSuccess: invalidateStaffUserMutation,
  });
}
