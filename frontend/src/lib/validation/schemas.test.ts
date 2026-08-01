import { describe, expect, it } from 'vitest';
import {
  bookSchema,
  borrowingSchema,
  catalogSchema,
  listQuerySchema,
  memberLoginSchema,
  memberPolicyStatusSchema,
  memberSchema,
  memberSelfServiceProfileSchema,
  membershipTierSchema,
  returnSchema,
  staffLoginSchema,
} from './schemas';

describe('validation schemas', () => {
  it('normalizes list controls and enforces bounded positive pagination', () => {
    expect(listQuerySchema.parse({ q: '  dune  ' })).toEqual({
      q: 'dune',
      page: 1,
      limit: 20,
    });
    expect(listQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(listQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('validates staff and member compatibility credentials', () => {
    expect(
      staffLoginSchema.parse({
        email: 'staff@example.com',
        password: 'Password#2026',
      }),
    ).toEqual({ email: 'staff@example.com', password: 'Password#2026' });
    expect(
      memberLoginSchema.parse({
        loginIdentifier: '  M-1001  ',
        password: 'Password#2026',
      }),
    ).toEqual({ loginIdentifier: 'M-1001', password: 'Password#2026' });
    expect(
      staffLoginSchema.safeParse({ email: 'not-an-email', password: 'short' })
        .success,
    ).toBe(false);
    expect(
      memberLoginSchema.safeParse({ loginIdentifier: '   ', password: 'short' })
        .success,
    ).toBe(false);
  });

  it('normalizes and validates catalog-managed records', () => {
    expect(
      bookSchema.parse({
        catalogIdentifier: '  BK-100  ',
        title: '  Dune  ',
        author: '  Frank Herbert  ',
        isbn: '  9780441172719  ',
        coverImageUrl: 'https://example.com/dune.jpg',
        categoryId: '  fiction  ',
        totalQuantity: '3',
        availableQuantity: '2',
        status: 'active',
      }),
    ).toMatchObject({
      catalogIdentifier: 'BK-100',
      title: 'Dune',
      author: 'Frank Herbert',
      categoryId: 'fiction',
      totalQuantity: 3,
      availableQuantity: 2,
      status: 'active',
    });
    expect(
      catalogSchema.parse({
        code: '  SCI  ',
        name: '  Science  ',
        loanPeriodDays: '14',
        status: 'active',
      }),
    ).toEqual({
      code: 'SCI',
      name: 'Science',
      loanPeriodDays: 14,
      status: 'active',
    });
    expect(
      membershipTierSchema.parse({
        code: '  STD  ',
        name: '  Standard  ',
        maxActiveLoans: '5',
        status: 'active',
      }),
    ).toEqual({
      code: 'STD',
      name: 'Standard',
      maxActiveLoans: 5,
      status: 'active',
    });
    expect(
      bookSchema.safeParse({
        catalogIdentifier: '',
        title: '',
        author: '',
        categoryId: '',
        totalQuantity: -1,
        availableQuantity: -1,
        status: 'unknown',
      }).success,
    ).toBe(false);
  });

  it('validates member, borrowing, and optional return boundaries', () => {
    expect(
      memberSchema.parse({
        memberNumber: '  M-1001  ',
        fullName: '  Member One  ',
        email: 'member@example.com',
        phone: '  555-0100  ',
        membershipTypeId: '  tier-1  ',
        status: 'active',
        activeLoanCount: '2',
      }),
    ).toMatchObject({
      memberNumber: 'M-1001',
      fullName: 'Member One',
      membershipTypeId: 'tier-1',
      activeLoanCount: 2,
    });
    expect(
      borrowingSchema.parse({
        memberId: '  member-1  ',
        bookId: '  book-1  ',
        borrowedAt: '2026-07-01T00:00:00.000Z',
        dueAt: '2026-07-15T00:00:00.000Z',
        status: 'active',
      }),
    ).toMatchObject({ memberId: 'member-1', bookId: 'book-1' });
    expect(returnSchema.parse({})).toEqual({});
    expect(
      returnSchema.parse({ returnedAt: '2026-07-12T00:00:00.000Z' }),
    ).toEqual({ returnedAt: '2026-07-12T00:00:00.000Z' });
    expect(
      borrowingSchema.safeParse({
        memberId: 'member-1',
        bookId: 'book-1',
        borrowedAt: 'not-a-date',
        dueAt: '2026-07-15T00:00:00.000Z',
        status: 'active',
      }).success,
    ).toBe(false);
  });

  it('validates member self-service profile and policy responses', () => {
    expect(
      memberSelfServiceProfileSchema.parse({
        id: 'member-1',
        memberNumber: 'M-1001',
        displayName: 'Member One',
        email: 'member@example.com',
        membershipStatus: 'active',
        membershipTypeId: 'tier-1',
        membershipTypeCode: 'STD',
        membershipTypeName: 'Standard',
        activeLoanCount: 2,
      }),
    ).toMatchObject({
      memberNumber: 'M-1001',
      membershipStatus: 'active',
      activeLoanCount: 2,
    });
    expect(
      memberPolicyStatusSchema.parse({
        memberId: 'member-1',
        status: 'active',
        membershipTypeId: 'tier-1',
        maxActiveLoans: 5,
        activeLoanCount: 2,
        remainingAllowance: 3,
        eligibleByStatus: true,
        withinLimit: true,
        limitReached: false,
      }),
    ).toMatchObject({
      memberId: 'member-1',
      remainingAllowance: 3,
      limitReached: false,
    });
    expect(
      memberPolicyStatusSchema.safeParse({
        memberId: 'member-1',
        status: 'active',
        membershipTypeId: 'tier-1',
        maxActiveLoans: 5,
        activeLoanCount: 6,
        remainingAllowance: -1,
        eligibleByStatus: true,
        withinLimit: false,
        limitReached: true,
      }).success,
    ).toBe(false);
  });
});
