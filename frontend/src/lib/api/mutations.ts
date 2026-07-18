import { queryClient } from '@/app/query-client';
import { queryKeys } from './query-keys';
import type { BorrowingView } from './types';

export async function invalidateBookMutation(bookId?: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['staff', 'books'] }),
    bookId
      ? queryClient.invalidateQueries({
          queryKey: queryKeys.staff.book(bookId),
        })
      : Promise.resolve(),
  ]);
}

export async function invalidateMemberMutation(memberId?: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['staff', 'members'] }),
    memberId
      ? queryClient.invalidateQueries({
          queryKey: queryKeys.staff.member(memberId),
        })
      : Promise.resolve(),
    memberId
      ? queryClient.invalidateQueries({
          queryKey: queryKeys.staff.memberPolicy(memberId),
        })
      : Promise.resolve(),
  ]);
}

export async function invalidateBorrowingMutation(borrowing: BorrowingView) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['staff', 'books'] }),
    queryClient.invalidateQueries({ queryKey: ['staff', 'borrowings'] }),
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

export async function invalidateStaffUserMutation() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['staff', 'staff-users'] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.staff.roleReview }),
  ]);
}

export async function invalidateIdentifierConflictMutation(
  operationId?: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: ['staff', 'identifier-conflicts'],
    }),
    operationId
      ? queryClient.invalidateQueries({
          queryKey: queryKeys.staff.identifierOperation(operationId),
        })
      : Promise.resolve(),
  ]);
}
