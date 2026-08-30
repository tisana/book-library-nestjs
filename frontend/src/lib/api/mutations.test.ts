import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryClient } from '@/app/query-client';
import { invalidateBookMutation, invalidateBorrowingMutation, invalidateIdentifierConflictMutation, invalidateMemberMutation, invalidateStaffUserMutation } from './mutations';

const borrowing = { id: 'borrowing-1', memberId: 'member-1', bookId: 'book-1', bookCategoryId: 'category-1', borrowedAt: '2026-06-01T00:00:00.000Z', dueAt: '2026-06-15T00:00:00.000Z', status: 'active', borrowedByStaffId: 'staff-1' } as const;

describe('mutation invalidation contracts', () => {
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
  afterEach(() => { invalidateQueries.mockReset(); invalidateQueries.mockResolvedValue(undefined); });

  it('invalidates only the book collection without an id and includes the exact detail key with one', async () => {
    invalidateQueries.mockResolvedValue(undefined);
    await invalidateBookMutation();
    expect(invalidateQueries).toHaveBeenCalledExactlyOnceWith({ queryKey: ['staff', 'books'] });
    invalidateQueries.mockClear();
    await invalidateBookMutation('book-1');
    expect(invalidateQueries.mock.calls).toEqual([[{ queryKey: ['staff', 'books'] }], [{ queryKey: ['staff', 'book', 'book-1'] }]]);
  });

  it('covers absent and present member detail and policy invalidations', async () => {
    invalidateQueries.mockResolvedValue(undefined);
    await invalidateMemberMutation();
    expect(invalidateQueries).toHaveBeenCalledExactlyOnceWith({ queryKey: ['staff', 'members'] });
    invalidateQueries.mockClear();
    await invalidateMemberMutation('member-1');
    expect(invalidateQueries.mock.calls).toEqual([[{ queryKey: ['staff', 'members'] }], [{ queryKey: ['staff', 'member', 'member-1'] }], [{ queryKey: ['staff', 'member-policy', 'member-1'] }]]);
  });

  it('invalidates every borrowing-dependent staff and member scope', async () => {
    invalidateQueries.mockResolvedValue(undefined);
    await invalidateBorrowingMutation(borrowing);
    expect(invalidateQueries.mock.calls).toEqual([
      [{ queryKey: ['staff', 'books'] }], [{ queryKey: ['staff', 'borrowings'] }], [{ queryKey: ['staff', 'borrowing', 'borrowing-1'] }],
      [{ queryKey: ['staff', 'member-policy', 'member-1'] }], [{ queryKey: ['staff', 'member-borrowings', 'member-1'] }], [{ queryKey: ['member'] }],
    ]);
  });

  it('invalidates staff user and role-review keys', async () => {
    invalidateQueries.mockResolvedValue(undefined);
    await invalidateStaffUserMutation();
    expect(invalidateQueries.mock.calls).toEqual([[{ queryKey: ['staff', 'staff-users'] }], [{ queryKey: ['staff', 'role-review'] }]]);
  });

  it('covers absent and present identifier-operation invalidations', async () => {
    invalidateQueries.mockResolvedValue(undefined);
    await invalidateIdentifierConflictMutation();
    expect(invalidateQueries).toHaveBeenCalledExactlyOnceWith({ queryKey: ['staff', 'identifier-conflicts'] });
    invalidateQueries.mockClear();
    await invalidateIdentifierConflictMutation('operation-1');
    expect(invalidateQueries.mock.calls).toEqual([[{ queryKey: ['staff', 'identifier-conflicts'] }], [{ queryKey: ['staff', 'identifier-operation', 'operation-1'] }]]);
  });
});
