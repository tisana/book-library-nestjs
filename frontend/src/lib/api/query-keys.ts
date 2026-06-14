export const queryKeys = {
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
