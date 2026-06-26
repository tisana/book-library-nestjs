import type { BorrowingView } from '@/lib/api/types';

interface DisplayText {
  primary: string;
  secondary: string;
}

function visibleText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export function getMemberDisplay(borrowing: BorrowingView): DisplayText {
  const primary = visibleText(borrowing.memberDisplayName, 'Unknown member');
  const secondary = visibleText(borrowing.memberNumber, borrowing.memberId);

  return { primary, secondary };
}

export function getBookDisplay(borrowing: BorrowingView): DisplayText {
  const primary = visibleText(borrowing.bookTitle, 'Book unavailable');
  const secondary = visibleText(
    borrowing.bookCatalogIdentifier,
    borrowing.bookId,
  );

  return { primary, secondary };
}

export function getBorrowingDisplay(borrowing: BorrowingView) {
  const member = getMemberDisplay(borrowing);
  const book = getBookDisplay(borrowing);

  return `${book.primary} borrowed by ${member.primary}`;
}
