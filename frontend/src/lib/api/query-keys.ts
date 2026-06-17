export const queryKeys = {
  staff: {
    books: (query?: unknown) => ['staff', 'books', query ?? {}] as const,
    book: (bookId: string) => ['staff', 'book', bookId] as const,
    catalog: (query?: unknown) => ['staff', 'catalog', query ?? {}] as const,
    membershipTypes: (query?: unknown) =>
      ['staff', 'membership-types', query ?? {}] as const,
    members: (query?: unknown) => ['staff', 'members', query ?? {}] as const,
    member: (memberId: string) => ['staff', 'member', memberId] as const,
    memberPolicy: (memberId: string) =>
      ['staff', 'member-policy', memberId] as const,
    memberBorrowings: (memberId: string) =>
      ['staff', 'member-borrowings', memberId] as const,
    borrowings: (query?: unknown) => ['staff', 'borrowings', query ?? {}] as const,
    borrowing: (borrowingId: string) =>
      ['staff', 'borrowing', borrowingId] as const,
    overdueBorrowings: (query?: unknown) =>
      ['staff', 'borrowings', 'overdue', query ?? {}] as const,
  },
  books: {
    all: ['books'] as const,
    detail: (bookId: string) => ['books', bookId] as const,
  },
  catalog: {
    all: ['catalog'] as const,
  },
  membershipTypes: {
    all: ['membership-types'] as const,
  },
  members: {
    all: ['members'] as const,
    detail: (memberId: string) => ['members', memberId] as const,
    policy: (memberId: string) => ['members', memberId, 'policy'] as const,
  },
  borrowings: {
    all: ['borrowings'] as const,
    detail: (borrowingId: string) => ['borrowings', borrowingId] as const,
  },
  memberSelf: {
    profile: ['member-self', 'profile'] as const,
    policy: ['member-self', 'policy'] as const,
    borrowings: ['member-self', 'borrowings'] as const,
    borrowing: (borrowingId: string) =>
      ['member-self', 'borrowings', borrowingId] as const,
  },
};
