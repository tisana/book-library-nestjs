import type { Page, Route } from '@playwright/test';

const API_URL_PATTERN = /http:\/\/(?:localhost|127\.0\.0\.1):3000\/.*$/;

export const staffPermissions = [
  'catalog:read',
  'catalog:manage',
  'members:read',
  'members:manage',
  'membership-types:read',
  'membership-types:manage',
  'borrowings:read',
  'borrowings:manage',
];

export interface MockBook {
  id: string;
  title: string;
  author: string;
  catalogIdentifier: string;
  categoryId: string;
  totalQuantity: number;
  availableQuantity: number;
  status: 'active' | 'deactivated';
  isbn?: string;
  coverImageUrl?: string;
}

export interface MockMember {
  id: string;
  memberNumber: string;
  fullName: string;
  membershipTypeId: string;
  status: 'active' | 'suspended' | 'inactive';
  activeLoanCount: number;
  email?: string;
}

export interface MockBorrowing {
  id: string;
  memberId: string;
  memberDisplayName?: string;
  memberNumber?: string;
  bookId: string;
  bookTitle?: string;
  bookCatalogIdentifier?: string;
  bookCategoryId: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt?: string;
  status: 'active' | 'overdue' | 'returned';
  borrowedByStaffId: string;
  returnedByStaffId?: string;
}

interface StaffMockOptions {
  books?: MockBook[];
  members?: MockMember[];
  borrowings?: MockBorrowing[];
  overdueBorrowings?: MockBorrowing[];
}

interface MemberMockOptions {
  displayName?: string;
  membershipStatus?: 'active' | 'suspended' | 'inactive';
  borrowings?: MockBorrowing[];
  activeLoanCount?: number;
  maxActiveLoans?: number;
}

export const defaultBooks: MockBook[] = [
  {
    id: 'book-1',
    title: 'Clean Code',
    author: 'Robert C. Martin',
    catalogIdentifier: 'BK-1001',
    categoryId: 'cat-1',
    totalQuantity: 3,
    availableQuantity: 2,
    status: 'active',
    isbn: '9780132350884',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780132350884-M.jpg',
  },
  {
    id: 'book-2',
    title: 'Refactoring',
    author: 'Martin Fowler',
    catalogIdentifier: 'BK-1003',
    categoryId: 'cat-1',
    totalQuantity: 2,
    availableQuantity: 0,
    status: 'active',
    isbn: '9780134757599',
  },
];

export const defaultMembers: MockMember[] = [
  {
    id: 'member-1',
    memberNumber: 'M-1001',
    fullName: 'Jane Reader',
    membershipTypeId: 'tier-1',
    status: 'active',
    activeLoanCount: 1,
    email: 'jane.reader@example.test',
  },
  {
    id: 'member-2',
    memberNumber: 'M-1004',
    fullName: 'Olivia Overdue',
    membershipTypeId: 'tier-2',
    status: 'active',
    activeLoanCount: 1,
    email: 'olivia.overdue@example.test',
  },
];

export const defaultBorrowings: MockBorrowing[] = [
  {
    id: 'borrowing-1',
    memberId: 'member-1',
    memberDisplayName: 'Jane Reader',
    memberNumber: 'M-1001',
    bookId: 'book-1',
    bookTitle: 'Clean Code',
    bookCatalogIdentifier: 'BK-1001',
    bookCategoryId: 'cat-1',
    borrowedAt: '2026-06-03T00:00:00.000Z',
    dueAt: '2026-06-17T12:00:00.000Z',
    status: 'active',
    borrowedByStaffId: 'staff-1',
  },
  {
    id: 'borrowing-2',
    memberId: 'member-2',
    memberDisplayName: 'Olivia Overdue',
    memberNumber: 'M-1004',
    bookId: 'book-2',
    bookTitle: 'Refactoring',
    bookCatalogIdentifier: 'BK-1003',
    bookCategoryId: 'cat-1',
    borrowedAt: '2026-05-27T00:00:00.000Z',
    dueAt: '2026-06-03T00:00:00.000Z',
    status: 'overdue',
    borrowedByStaffId: 'staff-1',
  },
];

export async function mockStaffApi(page: Page, options: StaffMockOptions = {}) {
  const books = options.books ?? defaultBooks;
  const members = options.members ?? defaultMembers;
  const borrowings = options.borrowings ?? defaultBorrowings;
  const overdueBorrowings =
    options.overdueBorrowings ??
    borrowings.filter((borrowing) => borrowing.status === 'overdue');

  await page.route(API_URL_PATTERN, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === '/auth/login') {
      return fulfillJson(route, {
        accessToken: 'staff-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        scope: staffPermissions.join(' '),
        permissions: staffPermissions,
        roleArea: 'staff',
        user: {
          id: 'staff-1',
          email: 'staff@example.test',
          displayName: 'Staff User',
          roles: ['staff'],
          roleArea: 'staff',
          permissions: staffPermissions,
        },
      });
    }

    const memberPolicyMatch = path.match(/^\/members\/([^/]+)\/policy-status$/);
    if (memberPolicyMatch) {
      const member = members.find((item) => item.id === memberPolicyMatch[1]);
      return fulfillJson(route, {
        memberId: memberPolicyMatch[1],
        status: member?.status ?? 'active',
        membershipTypeId: member?.membershipTypeId ?? 'tier-1',
        maxActiveLoans: 3,
        activeLoanCount: member?.activeLoanCount ?? 0,
        remainingAllowance: Math.max(0, 3 - (member?.activeLoanCount ?? 0)),
        eligibleByStatus:
          member?.status === undefined || member.status === 'active',
        withinLimit: (member?.activeLoanCount ?? 0) < 3,
        limitReached: (member?.activeLoanCount ?? 0) >= 3,
      });
    }

    const memberBorrowingsMatch = path.match(
      /^\/members\/([^/]+)\/borrowings$/,
    );
    if (memberBorrowingsMatch) {
      return fulfillJson(
        route,
        borrowings.filter(
          (borrowing) => borrowing.memberId === memberBorrowingsMatch[1],
        ),
      );
    }

    const memberMatch = path.match(/^\/members\/([^/]+)$/);
    if (memberMatch) {
      return fulfillJson(
        route,
        members.find((member) => member.id === memberMatch[1]) ?? members[0],
      );
    }

    if (path === '/members') {
      return fulfillJson(route, members);
    }

    const bookMatch = path.match(/^\/books\/([^/]+)$/);
    if (bookMatch) {
      return fulfillJson(
        route,
        books.find((book) => book.id === bookMatch[1]) ?? books[0],
      );
    }

    if (path === '/books') {
      return fulfillJson(route, books);
    }

    if (path === '/book-categories') {
      return fulfillJson(route, [
        {
          id: 'cat-1',
          code: 'STANDARD',
          name: 'Standard',
          loanPeriodDays: 14,
          status: 'active',
        },
      ]);
    }

    if (path === '/membership-types') {
      return fulfillJson(route, [
        {
          id: 'tier-1',
          code: 'STANDARD',
          name: 'Standard',
          maxActiveLoans: 3,
          status: 'active',
        },
      ]);
    }

    if (path === '/borrowings/overdue') {
      return fulfillJson(route, overdueBorrowings);
    }

    const borrowingReturnMatch = path.match(/^\/borrowings\/([^/]+)\/return$/);
    if (borrowingReturnMatch) {
      const borrowing =
        borrowings.find((item) => item.id === borrowingReturnMatch[1]) ??
        borrowings[0];
      return fulfillJson(route, {
        ...borrowing,
        returnedAt: '2026-06-18T00:00:00.000Z',
        returnedByStaffId: 'staff-1',
        status: 'returned',
      });
    }

    const borrowingMatch = path.match(/^\/borrowings\/([^/]+)$/);
    if (borrowingMatch) {
      return fulfillJson(
        route,
        borrowings.find((borrowing) => borrowing.id === borrowingMatch[1]) ??
          borrowings[0],
      );
    }

    if (path === '/borrowings') {
      return fulfillJson(
        route,
        request.method() === 'POST' ? borrowings[0] : borrowings,
      );
    }

    return fulfillJson(
      route,
      { message: `No mock registered for ${path}` },
      404,
    );
  });
}

export async function mockMemberApi(
  page: Page,
  options: MemberMockOptions = {},
) {
  const borrowings = options.borrowings ?? defaultBorrowings.slice(0, 2);
  const activeLoanCount = options.activeLoanCount ?? borrowings.length;
  const maxActiveLoans = options.maxActiveLoans ?? 3;
  const membershipStatus = options.membershipStatus ?? 'active';
  const displayName = options.displayName ?? 'Jane Reader';

  await page.route(API_URL_PATTERN, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === '/auth/login') {
      return fulfillJson(route, {
        accessToken: 'member-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        scope: 'member:self:read',
        permissions: ['member:self:read'],
        roleArea: 'member',
        member: {
          id: 'member-1',
          memberNumber: 'M-1001',
          displayName,
          email: 'jane.reader@example.test',
          membershipStatus,
          membershipTypeId: 'tier-1',
          membershipTypeName: 'Gold Member',
          membershipTypeCode: 'GOLD',
          permissions: ['member:self:read'],
        },
      });
    }

    if (path === '/members/me') {
      return fulfillJson(route, {
        id: 'member-1',
        memberNumber: 'M-1001',
        displayName,
        email: 'jane.reader@example.test',
        membershipStatus,
        membershipTypeId: 'tier-1',
        membershipTypeName: 'Gold Member',
        membershipTypeCode: 'GOLD',
        activeLoanCount,
      });
    }

    if (path === '/members/me/policy-status') {
      return fulfillJson(route, {
        memberId: 'member-1',
        status: membershipStatus,
        membershipTypeId: 'tier-1',
        maxActiveLoans,
        activeLoanCount,
        remainingAllowance: Math.max(0, maxActiveLoans - activeLoanCount),
        eligibleByStatus: membershipStatus === 'active',
        withinLimit: activeLoanCount < maxActiveLoans,
        limitReached: activeLoanCount >= maxActiveLoans,
      });
    }

    const borrowingDetailMatch = path.match(
      /^\/members\/me\/borrowings\/([^/]+)$/,
    );
    if (borrowingDetailMatch) {
      return fulfillJson(
        route,
        borrowings.find(
          (borrowing) => borrowing.id === borrowingDetailMatch[1],
        ) ?? borrowings[0],
      );
    }

    if (path === '/members/me/borrowings') {
      return fulfillJson(route, borrowings);
    }

    return fulfillJson(
      route,
      { message: `No mock registered for ${path}` },
      404,
    );
  });
}

export async function loginAsStaff(page: Page) {
  await page.goto('/staff/login');
  await page.getByLabel('Email').fill('staff@example.test');
  await page.getByLabel('Password').fill('Password#2026');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/staff');
}

export async function loginAsMember(page: Page) {
  await page.goto('/member/login');
  await page.getByLabel('Login identifier').fill('M-1001');
  await page.getByLabel('Password').fill('DemoMember#2026');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/member');
}

export function createPerformanceDataset() {
  const books = Array.from({ length: 100 }, (_, index): MockBook => {
    const number = index + 1;
    return {
      id: `book-${number}`,
      title: `Demo Book ${number.toString().padStart(3, '0')}`,
      author: `Author ${number}`,
      catalogIdentifier: `BK-${(2000 + number).toString()}`,
      categoryId: 'cat-1',
      totalQuantity: 4,
      availableQuantity: number % 5 === 0 ? 0 : 2,
      status: number % 20 === 0 ? 'deactivated' : 'active',
    };
  });

  const members = Array.from({ length: 50 }, (_, index): MockMember => {
    const number = index + 1;
    return {
      id: `member-${number}`,
      memberNumber: `M-${(2000 + number).toString()}`,
      fullName: `Demo Member ${number.toString().padStart(2, '0')}`,
      membershipTypeId: 'tier-1',
      status: number % 17 === 0 ? 'suspended' : 'active',
      activeLoanCount: number % 4,
    };
  });

  const activeBorrowings = Array.from(
    { length: 25 },
    (_, index): MockBorrowing => {
      const number = index + 1;
      const book = books[index];
      const member = members[index % members.length];
      return createBorrowing(number, member, book, 'active');
    },
  );

  const overdueBorrowings = Array.from(
    { length: 10 },
    (_, index): MockBorrowing => {
      const number = index + 26;
      const book = books[index + 25];
      const member = members[(index + 25) % members.length];
      return createBorrowing(number, member, book, 'overdue');
    },
  );

  return {
    books,
    members,
    borrowings: [...activeBorrowings, ...overdueBorrowings],
    overdueBorrowings,
  };
}

function createBorrowing(
  number: number,
  member: MockMember,
  book: MockBook,
  status: 'active' | 'overdue',
): MockBorrowing {
  return {
    id: `borrowing-${number}`,
    memberId: member.id,
    memberDisplayName: member.fullName,
    memberNumber: member.memberNumber,
    bookId: book.id,
    bookTitle: book.title,
    bookCatalogIdentifier: book.catalogIdentifier,
    bookCategoryId: book.categoryId,
    borrowedAt: '2026-06-01T00:00:00.000Z',
    dueAt:
      status === 'overdue'
        ? '2026-06-05T00:00:00.000Z'
        : '2026-06-25T00:00:00.000Z',
    status,
    borrowedByStaffId: 'staff-1',
  };
}

async function fulfillJson(route: Route, json: unknown, status = 200) {
  await route.fulfill({ status, json });
}
