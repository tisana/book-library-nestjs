import { describe, expect, it } from 'vitest';
import type { BorrowingView } from '@/lib/api/types';
import {
  getBookDisplay,
  getBorrowingDisplay,
  getMemberDisplay,
} from './borrowing-display';

const borrowing: BorrowingView = {
  id: 'borrow-1',
  memberId: 'member-1',
  memberDisplayName: 'Olivia Overdue',
  memberNumber: 'M-1004',
  bookId: 'book-1',
  bookTitle: 'Refactoring',
  bookCatalogIdentifier: 'BK-1003',
  bookCategoryId: 'cat-1',
  borrowedAt: '2026-06-01T00:00:00.000Z',
  dueAt: '2026-06-15T00:00:00.000Z',
  status: 'overdue',
  borrowedByStaffId: 'staff-1',
};

describe('borrowing display helpers', () => {
  it('prefers human-readable member and book labels', () => {
    expect(getMemberDisplay(borrowing)).toEqual({
      primary: 'Olivia Overdue',
      secondary: 'M-1004',
    });
    expect(getBookDisplay(borrowing)).toEqual({
      primary: 'Refactoring',
      secondary: 'BK-1003',
    });
    expect(getBorrowingDisplay(borrowing)).toBe(
      'Refactoring borrowed by Olivia Overdue',
    );
  });

  it('falls back to safe labels and diagnostic IDs', () => {
    const missingReferences: BorrowingView = {
      ...borrowing,
      memberDisplayName: undefined,
      memberNumber: undefined,
      bookTitle: undefined,
      bookCatalogIdentifier: undefined,
    };

    expect(getMemberDisplay(missingReferences)).toEqual({
      primary: 'Unknown member',
      secondary: 'member-1',
    });
    expect(getBookDisplay(missingReferences)).toEqual({
      primary: 'Book unavailable',
      secondary: 'book-1',
    });
    expect(getBorrowingDisplay(missingReferences)).toBe(
      'Book unavailable borrowed by Unknown member',
    );
  });
});
