import { BorrowingsRulesService } from './borrowings-rules.service';
import { BorrowingsService } from './borrowings.service';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { LoanState } from '../common/enums/library-status.enum';
import { BorrowingQueryDto } from './dto/borrowing.dto';

describe('BorrowingsService', () => {
  function createService(
    borrowingModel: Record<string, unknown> = {},
  ): BorrowingsService {
    return new BorrowingsService(
      {} as never,
      borrowingModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      new BorrowingsRulesService(),
    );
  }

  it('calculates due dates from the book category loan period in UTC days', () => {
    const service = createService();
    const borrowedAt = new Date('2026-06-01T00:00:00.000Z');

    expect(service.calculateDueAt(borrowedAt, 14).toISOString()).toBe(
      '2026-06-15T00:00:00.000Z',
    );
  });

  it('maps populated member and book display fields into borrowing responses', async () => {
    const borrowing = createBorrowingDocument({
      memberId: {
        _id: { toString: () => 'member-1' },
        fullName: 'Inactive Reader',
        memberNumber: 'M-1004',
        status: 'inactive',
      },
      bookId: {
        _id: { toString: () => 'book-1' },
        title: 'Refactoring',
        catalogIdentifier: 'BK-1003',
        status: 'deactivated',
      },
    });
    const query = createFindQuery([borrowing]);
    const find = jest.fn().mockReturnValue(query);
    const service = createService({ find });

    await expect(service.findAll({ page: 1, limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        memberId: 'member-1',
        memberDisplayName: 'Inactive Reader',
        memberNumber: 'M-1004',
        bookId: 'book-1',
        bookTitle: 'Refactoring',
        bookCatalogIdentifier: 'BK-1003',
      }),
    ]);
  });

  it('returns safe display labels when member or book references are unavailable', async () => {
    const borrowing = createBorrowingDocument({
      memberId: '665f4d3b8f4c8a001f5f0a12',
      bookId: '665f4d3b8f4c8a001f5f0a13',
    });
    const query = createFindQuery([borrowing]);
    const find = jest.fn().mockReturnValue(query);
    const service = createService({ find });

    await expect(service.findAll({ page: 1, limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        memberId: '665f4d3b8f4c8a001f5f0a12',
        memberDisplayName: 'Unknown member',
        bookId: '665f4d3b8f4c8a001f5f0a13',
        bookTitle: 'Book unavailable',
      }),
    ]);
  });

  it('does not mutate the borrowed date while calculating the due date', () => {
    const service = createService();
    const borrowedAt = new Date('2026-06-01T00:00:00.000Z');

    service.calculateDueAt(borrowedAt, 7);

    expect(borrowedAt.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('requires an authenticated staff actor before creating borrowing records', async () => {
    const service = createService();

    await expect(
      service.create({
        memberId: '665f4d3b8f4c8a001f5f0a12',
        bookId: '665f4d3b8f4c8a001f5f0a13',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('requires an authenticated staff actor before returning borrowing records', async () => {
    const service = createService();

    await expect(
      service.returnBorrowing('borrowing-id'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('filters current borrowings to unreturned active and overdue records', async () => {
    const queryBuilder = createFindQuery([]);
    const find = jest.fn().mockReturnValue(queryBuilder);
    const service = createService({ find });
    const query = {
      currentOnly: true,
      page: 1,
      limit: 20,
    } as BorrowingQueryDto & { currentOnly: boolean };

    await service.findAll(query);

    expect(find).toHaveBeenCalledWith({
      returnedAt: { $exists: false },
      status: { $in: [LoanState.Active, LoanState.Overdue] },
    });
  });

  it('rejects member self-service queries with a mismatched memberId', async () => {
    const service = createService();

    await expect(
      service.findByMember('member-1', {
        memberId: 'member-2',
        page: 1,
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

function createFindQuery(result: unknown[]) {
  const query = {
    populate: jest.fn(() => query),
    sort: jest.fn(() => query),
    skip: jest.fn(() => query),
    limit: jest.fn(() => query),
    exec: jest.fn().mockResolvedValue(result),
  };

  return query;
}

function createBorrowingDocument(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'borrowing-1',
    _id: { toString: () => 'borrowing-1' },
    memberId: 'member-1',
    bookId: 'book-1',
    bookCategoryId: { toString: () => 'category-1' },
    borrowedAt: new Date('2026-06-01T00:00:00.000Z'),
    dueAt: new Date('2026-06-15T00:00:00.000Z'),
    status: LoanState.Active,
    borrowedByStaffId: 'staff-1',
    ...overrides,
  };
}
