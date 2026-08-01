import { describe, expect, it } from 'vitest';
import { queryKeys } from './query-keys';

describe('query keys', () => {
  it('keeps every staff collection, detail, and optional query variant stable', () => {
    expect(queryKeys.staff.books()).toEqual(['staff', 'books', {}]);
    expect(queryKeys.staff.books({ status: 'active' })).toEqual(['staff', 'books', { status: 'active' }]);
    expect(queryKeys.staff.book('book-1')).toEqual(['staff', 'book', 'book-1']);
    expect(queryKeys.staff.catalog()).toEqual(['staff', 'catalog', {}]);
    expect(queryKeys.staff.catalog({ status: 'active' })).toEqual(['staff', 'catalog', { status: 'active' }]);
    expect(queryKeys.staff.membershipTypes()).toEqual(['staff', 'membership-types', {}]);
    expect(queryKeys.staff.membershipTypes({ status: 'active' })).toEqual(['staff', 'membership-types', { status: 'active' }]);
    expect(queryKeys.staff.members()).toEqual(['staff', 'members', {}]);
    expect(queryKeys.staff.members({ status: 'active' })).toEqual(['staff', 'members', { status: 'active' }]);
    expect(queryKeys.staff.member('member-1')).toEqual(['staff', 'member', 'member-1']);
    expect(queryKeys.staff.memberPolicy('member-1')).toEqual(['staff', 'member-policy', 'member-1']);
    expect(queryKeys.staff.memberBorrowings('member-1')).toEqual(['staff', 'member-borrowings', 'member-1']);
    expect(queryKeys.staff.borrowings()).toEqual(['staff', 'borrowings', {}]);
    expect(queryKeys.staff.borrowings({ page: 2 })).toEqual(['staff', 'borrowings', { page: 2 }]);
    expect(queryKeys.staff.borrowing('borrowing-1')).toEqual(['staff', 'borrowing', 'borrowing-1']);
    expect(queryKeys.staff.overdueBorrowings()).toEqual(['staff', 'borrowings', 'overdue', {}]);
    expect(queryKeys.staff.overdueBorrowings({ limit: 10 })).toEqual(['staff', 'borrowings', 'overdue', { limit: 10 }]);
    expect(queryKeys.staff.staffUsers()).toEqual(['staff', 'staff-users', {}]);
    expect(queryKeys.staff.staffUsers({ status: 'active' })).toEqual(['staff', 'staff-users', { status: 'active' }]);
    expect(queryKeys.staff.roleReview).toEqual(['staff', 'role-review']);
    expect(queryKeys.staff.identifierConflicts()).toEqual(['staff', 'identifier-conflicts', {}]);
    expect(queryKeys.staff.identifierConflicts({ page: 1 })).toEqual(['staff', 'identifier-conflicts', { page: 1 }]);
    expect(queryKeys.staff.identifierOperation('operation-1')).toEqual(['staff', 'identifier-operation', 'operation-1']);
    expect(queryKeys.staff.securityActivity()).toEqual(['staff', 'security-activity', {}]);
    expect(queryKeys.staff.securityActivity({ outcome: 'success' })).toEqual(['staff', 'security-activity', { outcome: 'success' }]);
  });

  it('keeps legacy and member-self keys stable', () => {
    expect(queryKeys.books.all).toEqual(['books']);
    expect(queryKeys.books.detail('book-1')).toEqual(['books', 'book-1']);
    expect(queryKeys.catalog.all).toEqual(['catalog']);
    expect(queryKeys.membershipTypes.all).toEqual(['membership-types']);
    expect(queryKeys.members.all).toEqual(['members']);
    expect(queryKeys.members.detail('member-1')).toEqual(['members', 'member-1']);
    expect(queryKeys.members.policy('member-1')).toEqual(['members', 'member-1', 'policy']);
    expect(queryKeys.borrowings.all).toEqual(['borrowings']);
    expect(queryKeys.borrowings.detail('borrowing-1')).toEqual(['borrowings', 'borrowing-1']);
    expect(queryKeys.memberSelf.profile).toEqual(['member', 'me']);
    expect(queryKeys.memberSelf.policy).toEqual(['member', 'policy-status']);
    expect(queryKeys.memberSelf.borrowings()).toEqual(['member', 'borrowings', {}]);
    expect(queryKeys.memberSelf.borrowings({ currentOnly: true })).toEqual(['member', 'borrowings', { currentOnly: true }]);
    expect(queryKeys.memberSelf.borrowing('borrowing-1')).toEqual(['member', 'borrowing', 'borrowing-1']);
  });
});
