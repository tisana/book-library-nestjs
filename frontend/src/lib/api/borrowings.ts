import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '@/app/query-client';
import { apiClient } from './client';
import { queryKeys } from './query-keys';
import type {
  BorrowingView,
  CreateBorrowingInput,
  ListQuery,
  ReturnBorrowingInput,
} from './types';

const asArray = <T>(value: T[] | { items: T[] }) =>
  Array.isArray(value) ? value : value.items;

function borrowingQueryPath(basePath: string, query: ListQuery = {}) {
  const search = new URLSearchParams();
  if (query.status) search.set('status', query.status);
  if (query.page) search.set('page', String(query.page));
  if (query.limit) search.set('limit', String(query.limit));
  return `${basePath}?${search.toString()}`;
}

export function listBorrowings(query: ListQuery = {}) {
  return apiClient
    .get<
      BorrowingView[] | { items: BorrowingView[] }
    >(borrowingQueryPath('/borrowings', query))
    .then(asArray);
}

export function listOverdueBorrowings(query: ListQuery = {}) {
  return apiClient
    .get<
      BorrowingView[] | { items: BorrowingView[] }
    >(borrowingQueryPath('/borrowings/overdue', query))
    .then(asArray);
}

export function getBorrowing(borrowingId: string) {
  return apiClient.get<BorrowingView>(`/borrowings/${borrowingId}`);
}

export function createBorrowing(input: CreateBorrowingInput) {
  return apiClient.post<BorrowingView>('/borrowings', input);
}

export function returnBorrowing(
  borrowingId: string,
  input: ReturnBorrowingInput = {},
) {
  return apiClient.post<BorrowingView>(
    `/borrowings/${borrowingId}/return`,
    input,
  );
}

export function useBorrowings(query: ListQuery = {}) {
  return useQuery({
    queryKey: queryKeys.staff.borrowings(query),
    queryFn: () => listBorrowings(query),
  });
}

export function useOverdueBorrowings(query: ListQuery = {}) {
  return useQuery({
    queryKey: queryKeys.staff.overdueBorrowings(query),
    queryFn: () => listOverdueBorrowings(query),
  });
}

export function useBorrowing(borrowingId: string) {
  return useQuery({
    queryKey: queryKeys.staff.borrowing(borrowingId),
    queryFn: () => getBorrowing(borrowingId),
    enabled: Boolean(borrowingId),
  });
}

export function useCreateBorrowing() {
  return useMutation({
    mutationFn: createBorrowing,
    onSuccess: async (borrowing) => {
      await invalidateBorrowingMutation(borrowing);
    },
  });
}

export function useReturnBorrowing(borrowingId: string) {
  return useMutation({
    mutationFn: (input: ReturnBorrowingInput = {}) =>
      returnBorrowing(borrowingId, input),
    onSuccess: async (borrowing) => {
      await invalidateBorrowingMutation(borrowing);
    },
  });
}

async function invalidateBorrowingMutation(borrowing: BorrowingView) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['staff', 'books'] }),
    queryClient.invalidateQueries({ queryKey: ['staff', 'borrowings'] }),
    queryClient.invalidateQueries({ queryKey: ['staff', 'members'] }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.staff.borrowing(borrowing.id),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.staff.memberPolicy(borrowing.memberId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.staff.memberBorrowings(borrowing.memberId),
    }),
    queryClient.invalidateQueries({ queryKey: ['member'] }),
  ]);
}
