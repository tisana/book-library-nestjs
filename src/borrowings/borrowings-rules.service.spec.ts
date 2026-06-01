import { ConflictException } from '@nestjs/common';
import {
  LibraryItemStatus,
  MemberStatus,
} from '../common/enums/library-status.enum';
import {
  BorrowingPolicyInput,
  BorrowingsRulesService,
} from './borrowings-rules.service';

describe('BorrowingsRulesService', () => {
  let service: BorrowingsRulesService;

  function validPolicy(
    overrides: Partial<BorrowingPolicyInput> = {},
  ): BorrowingPolicyInput {
    return {
      book: {
        availableQuantity: 1,
        status: LibraryItemStatus.Active,
      },
      category: {
        loanPeriodDays: 14,
        status: LibraryItemStatus.Active,
      },
      member: {
        activeLoanCount: 1,
        status: MemberStatus.Active,
      },
      membershipType: {
        maxActiveLoans: 3,
        status: LibraryItemStatus.Active,
      },
      hasOverdueLoans: false,
      ...overrides,
    };
  }

  beforeEach(() => {
    service = new BorrowingsRulesService();
  });

  it('allows borrowing when all policy inputs are eligible', () => {
    expect(() => service.assertCanBorrow(validPolicy())).not.toThrow();
  });

  it('rejects unavailable or deactivated books', () => {
    expect(() =>
      service.assertCanBorrow(
        validPolicy({
          book: {
            availableQuantity: 0,
            status: LibraryItemStatus.Active,
          },
        }),
      ),
    ).toThrow(ConflictException);

    expect(() =>
      service.assertCanBorrow(
        validPolicy({
          book: {
            availableQuantity: 1,
            status: LibraryItemStatus.Deactivated,
          },
        }),
      ),
    ).toThrow('Book is not available for borrowing');
  });

  it('rejects inactive categories or missing loan periods', () => {
    expect(() =>
      service.assertCanBorrow(
        validPolicy({
          category: {
            loanPeriodDays: 0,
            status: LibraryItemStatus.Active,
          },
        }),
      ),
    ).toThrow('Book category has no active loan period');
  });

  it('rejects inactive members and inactive membership types', () => {
    expect(() =>
      service.assertCanBorrow(
        validPolicy({
          member: {
            activeLoanCount: 1,
            status: MemberStatus.Suspended,
          },
        }),
      ),
    ).toThrow('Member is not active');

    expect(() =>
      service.assertCanBorrow(
        validPolicy({
          membershipType: {
            maxActiveLoans: 3,
            status: LibraryItemStatus.Deactivated,
          },
        }),
      ),
    ).toThrow('Membership type is not active');
  });

  it('rejects members at their borrowing limit', () => {
    expect(() =>
      service.assertCanBorrow(
        validPolicy({
          member: {
            activeLoanCount: 3,
            status: MemberStatus.Active,
          },
        }),
      ),
    ).toThrow('Member borrowing limit has been reached');
  });

  it('rejects members with overdue loans', () => {
    expect(() =>
      service.assertCanBorrow(validPolicy({ hasOverdueLoans: true })),
    ).toThrow('Member has overdue loans');
  });
});
