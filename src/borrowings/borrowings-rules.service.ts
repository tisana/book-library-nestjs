import { ConflictException, Injectable } from '@nestjs/common';
import {
  LibraryItemStatus,
  MemberStatus,
} from '../common/enums/library-status.enum';

export interface BorrowingPolicyBook {
  availableQuantity: number;
  status: LibraryItemStatus;
}

export interface BorrowingPolicyCategory {
  loanPeriodDays: number;
  status: LibraryItemStatus;
}

export interface BorrowingPolicyMember {
  status: MemberStatus;
  activeLoanCount: number;
}

export interface BorrowingPolicyMembershipType {
  maxActiveLoans: number;
  status: LibraryItemStatus;
}

export interface BorrowingPolicyInput {
  book: BorrowingPolicyBook;
  category: BorrowingPolicyCategory;
  member: BorrowingPolicyMember;
  membershipType: BorrowingPolicyMembershipType;
  hasOverdueLoans: boolean;
}

@Injectable()
export class BorrowingsRulesService {
  assertCanBorrow(input: BorrowingPolicyInput): void {
    if (
      input.book.status !== LibraryItemStatus.Active ||
      input.book.availableQuantity < 1
    ) {
      throw new ConflictException('Book is not available for borrowing');
    }

    if (
      input.category.status !== LibraryItemStatus.Active ||
      input.category.loanPeriodDays < 1
    ) {
      throw new ConflictException('Book category has no active loan period');
    }

    if (input.member.status !== MemberStatus.Active) {
      throw new ConflictException('Member is not active');
    }

    if (input.membershipType.status !== LibraryItemStatus.Active) {
      throw new ConflictException('Membership type is not active');
    }

    if (input.member.activeLoanCount >= input.membershipType.maxActiveLoans) {
      throw new ConflictException('Member borrowing limit has been reached');
    }

    if (input.hasOverdueLoans) {
      throw new ConflictException('Member has overdue loans');
    }
  }
}
