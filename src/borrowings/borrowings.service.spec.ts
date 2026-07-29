import { BorrowingsRulesService } from './borrowings-rules.service';
import { BorrowingsService } from './borrowings.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  LibraryItemStatus,
  LoanState,
  MemberStatus,
} from '../common/enums/library-status.enum';
import { BorrowingQueryDto } from './dto/borrowing.dto';

describe('BorrowingsService', () => {
  const actor = { id: 'staff-1', email: 'staff@example.com', roles: [] };
  function createService(
    borrowingModel: Record<string, unknown> = {},
    dependencies: {
      connection?: Record<string, unknown>;
      bookModel?: Record<string, unknown>;
      bookCategoryModel?: Record<string, unknown>;
      memberModel?: Record<string, unknown>;
      membershipTypeModel?: Record<string, unknown>;
      rulesService?: BorrowingsRulesService;
    } = {},
  ): BorrowingsService {
    return new BorrowingsService(
      (dependencies.connection ?? {}) as never,
      borrowingModel as never,
      (dependencies.bookModel ?? {}) as never,
      (dependencies.bookCategoryModel ?? {}) as never,
      (dependencies.memberModel ?? {}) as never,
      (dependencies.membershipTypeModel ?? {}) as never,
      dependencies.rulesService ?? new BorrowingsRulesService(),
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

  it('creates a borrowing only after active member, book, category, and membership policy pass', async () => {
    const fixture = createBorrowingLifecycleFixture();
    const service = createService(fixture.borrowingModel, fixture.dependencies);

    const result = await service.create(
      { memberId: fixture.memberId, bookId: fixture.bookId },
      actor,
    );

    expect(result).toMatchObject({
      memberId: fixture.memberId,
      bookId: fixture.bookId,
      status: LoanState.Active,
      borrowedByStaffId: 'staff-1',
    });
    expect(fixture.createdBorrowing).toMatchObject({
      memberId: fixture.member._id,
      bookId: fixture.book._id,
      status: LoanState.Active,
    });
    expect(fixture.book.availableQuantity).toBe(1);
    expect(fixture.member.activeLoanCount).toBe(1);
    expect(fixture.rulesService.assertCanBorrow).toHaveBeenCalledWith({
      book: fixture.book,
      category: fixture.category,
      member: fixture.member,
      membershipType: fixture.membershipType,
      hasOverdueLoans: false,
    });
    expect(fixture.memberQuery.session).toHaveBeenCalledWith(fixture.session);
    expect(fixture.bookQuery.session).toHaveBeenCalledWith(fixture.session);
    expect(fixture.categoryQuery.session).toHaveBeenCalledWith(fixture.session);
    expect(fixture.membershipTypeQuery.session).toHaveBeenCalledWith(
      fixture.session,
    );
    expect(fixture.overdueQuery.session).toHaveBeenCalledWith(fixture.session);
    expect(fixture.createdBorrowing.save).toHaveBeenCalledWith({
      session: fixture.session,
    });
    expect(fixture.book.save).toHaveBeenCalledWith({ session: fixture.session });
    expect(fixture.member.save).toHaveBeenCalledWith({
      session: fixture.session,
    });
    const policyCall = fixture.rulesService.assertCanBorrow as jest.Mock;
    const borrowingSave = fixture.createdBorrowing.save as jest.Mock;
    expect(policyCall.mock.invocationCallOrder[0]).toBeLessThan(
      borrowingSave.mock.invocationCallOrder[0],
    );
  });

  it('does not change book availability or member loans when borrowing persistence fails', async () => {
    const fixture = createBorrowingLifecycleFixture({
      borrowingSave: jest.fn().mockRejectedValue(new Error('write failed')),
    });
    const service = createService(fixture.borrowingModel, fixture.dependencies);

    await expect(
      service.create(
        { memberId: fixture.memberId, bookId: fixture.bookId },
        actor,
      ),
    ).rejects.toThrow('write failed');

    expect(fixture.book.availableQuantity).toBe(2);
    expect(fixture.member.activeLoanCount).toBe(0);
    expect(fixture.book.save).not.toHaveBeenCalled();
    expect(fixture.member.save).not.toHaveBeenCalled();
  });

  it('returns an active borrowing and decrements the member loan count once', async () => {
    const fixture = createBorrowingLifecycleFixture();
    const borrowing = createBorrowingDocument({
      _id: objectId(fixture.borrowingId),
      id: fixture.borrowingId,
      memberId: fixture.member._id,
      bookId: fixture.book._id,
      bookCategoryId: fixture.category._id,
      save: jest.fn().mockResolvedValue(undefined),
    });
    fixture.borrowingModel.findOne = jest
      .fn()
      .mockReturnValue(createSessionQuery(borrowing));
    fixture.member.activeLoanCount = 1;
    const service = createService(fixture.borrowingModel, fixture.dependencies);

    const result = await service.returnBorrowing(
      fixture.borrowingId,
      { returnedAt: '2026-06-10T00:00:00.000Z' },
      actor,
    );

    expect(result).toMatchObject({
      status: LoanState.Returned,
      returnedAt: '2026-06-10T00:00:00.000Z',
      returnedByStaffId: 'staff-1',
    });
    expect(borrowing.status).toBe(LoanState.Returned);
    expect(fixture.book.availableQuantity).toBe(3);
    expect(fixture.member.activeLoanCount).toBe(0);
  });

  it('rejects a duplicate return without changing availability or loan count', async () => {
    const fixture = createBorrowingLifecycleFixture();
    const borrowing = createBorrowingDocument({
      _id: objectId(fixture.borrowingId),
      id: fixture.borrowingId,
      memberId: fixture.member._id,
      bookId: fixture.book._id,
      returnedAt: new Date('2026-06-10T00:00:00.000Z'),
      status: LoanState.Returned,
      save: jest.fn(),
    });
    fixture.borrowingModel.findOne = jest
      .fn()
      .mockReturnValue(createSessionQuery(borrowing));
    fixture.member.activeLoanCount = 1;
    const service = createService(fixture.borrowingModel, fixture.dependencies);

    await expect(
      service.returnBorrowing(fixture.borrowingId, {}, actor),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(fixture.book.availableQuantity).toBe(2);
    expect(fixture.member.activeLoanCount).toBe(1);
    expect(fixture.book.save).not.toHaveBeenCalled();
    expect(fixture.member.save).not.toHaveBeenCalled();
  });

  it('uses member ownership and requested pagination values for member borrowing history', async () => {
    const queryBuilder = createFindQuery([]);
    const find = jest.fn().mockReturnValue(queryBuilder);
    const service = createService({ find });
    const memberId = '665f4d3b8f4c8a001f5f0a12';

    await service.findByMember(memberId, { page: 3, limit: 5 });

    expect(find).toHaveBeenCalledWith({
      memberId: { $eq: expect.objectContaining({ _bsontype: 'ObjectId' }) },
    });
    expect(queryBuilder.skip).toHaveBeenCalledWith(10);
    expect(queryBuilder.limit).toHaveBeenCalledWith(5);
  });

  it('applies the overdue-only filter before listing overdue borrowings', async () => {
    const queryBuilder = createFindQuery([]);
    const find = jest.fn().mockReturnValue(queryBuilder);
    const service = createService({ find });

    await service.findOverdue({ page: 1, limit: 10 });

    expect(find).toHaveBeenCalledWith({
      returnedAt: { $exists: false },
      status: { $in: [LoanState.Active, LoanState.Overdue] },
      dueAt: { $lt: expect.any(Date) },
    });
  });

  it('returns not found when a borrowing lookup has no matching record', async () => {
    const query = createFindQuery(null as never);
    const findOne = jest.fn().mockReturnValue(query);
    const service = createService({ findOne });

    await expect(
      service.findOne('665f4d3b8f4c8a001f5f0a14'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('looks up a borrowing with an exact ObjectId equality filter', async () => {
    const borrowingId = '665f4d3b8f4c8a001f5f0a14';
    const query = createFindQuery(createBorrowingDocument({
      _id: objectId(borrowingId),
      id: borrowingId,
    }));
    const findOne = jest.fn().mockReturnValue(query);
    const service = createService({ findOne });

    await expect(service.findOne(borrowingId)).resolves.toMatchObject({
      id: borrowingId,
    });

    const filter = findOne.mock.calls[0][0] as {
      _id: { $eq: { toHexString: () => string } };
    };
    expect(filter._id.$eq.toHexString()).toBe(borrowingId);
  });

  it('applies both borrowing and member ObjectId ownership filters for self-service detail', async () => {
    const borrowingId = '665f4d3b8f4c8a001f5f0a14';
    const memberId = '665f4d3b8f4c8a001f5f0a12';
    const query = createFindQuery(createBorrowingDocument({
      _id: objectId(borrowingId),
      id: borrowingId,
      memberId: objectId(memberId),
    }));
    const findOne = jest.fn().mockReturnValue(query);
    const service = createService({ findOne });

    await expect(service.findOneForMember(borrowingId, memberId)).resolves.toMatchObject({
      id: borrowingId,
      memberId,
    });

    const filter = findOne.mock.calls[0][0] as {
      _id: { $eq: { toHexString: () => string } };
      memberId: { $eq: { toHexString: () => string } };
    };
    expect(filter._id.$eq.toHexString()).toBe(borrowingId);
    expect(filter.memberId.$eq.toHexString()).toBe(memberId);
  });

  it('does not reveal a foreign borrowing when the owner filter is absent or wrong', async () => {
    const borrowingId = '665f4d3b8f4c8a001f5f0a14';
    const memberId = '665f4d3b8f4c8a001f5f0a12';
    const foreignBorrowing = createBorrowingDocument({
      _id: objectId(borrowingId),
      id: borrowingId,
      memberId: objectId('665f4d3b8f4c8a001f5f0a13'),
    });
    const findOne = jest.fn().mockImplementation((filter) => {
      const ownerId = filter.memberId?.$eq?.toHexString?.();
      return createFindQuery(ownerId === memberId ? null : foreignBorrowing);
    });
    const service = createService({ findOne });

    await expectBorrowingNotFound(
      service.findOneForMember(borrowingId, memberId),
    );
  });

  it('uses the same not-found response for a valid missing self-service borrowing', async () => {
    const findOne = jest.fn().mockReturnValue(createFindQuery(null));
    const service = createService({ findOne });

    await expectBorrowingNotFound(
      service.findOneForMember(
        '665f4d3b8f4c8a001f5f0a14',
        '665f4d3b8f4c8a001f5f0a12',
      ),
    );
  });

  it('keeps malformed borrowing IDs in the shared Mongo ID validation contract', async () => {
    const service = createService();

    await expect(service.findOne('not-a-mongo-id')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

function createFindQuery(result: unknown) {
  const query = {
    populate: jest.fn(() => query),
    sort: jest.fn(() => query),
    skip: jest.fn(() => query),
    limit: jest.fn(() => query),
    exec: jest.fn().mockResolvedValue(result),
  };

  return query;
}

async function expectBorrowingNotFound(operation: Promise<unknown>) {
  try {
    await operation;
    fail('Expected borrowing lookup to reject');
  } catch (error) {
    expect(error).toBeInstanceOf(NotFoundException);
    expect(error).toMatchObject({ message: 'Borrowing record not found' });
    expect((error as NotFoundException).getStatus()).toBe(404);
  }
}

function createSessionQuery(result: unknown) {
  const query = {
    session: jest.fn(() => query),
    exec: jest.fn().mockResolvedValue(result),
  };

  return query;
}

function objectId(value: string) {
  return { toString: () => value };
}

function createBorrowingLifecycleFixture(options: { borrowingSave?: jest.Mock } = {}) {
  const memberId = '665f4d3b8f4c8a001f5f0a12';
  const bookId = '665f4d3b8f4c8a001f5f0a13';
  const categoryId = '665f4d3b8f4c8a001f5f0a14';
  const membershipTypeId = '665f4d3b8f4c8a001f5f0a15';
  const borrowingId = '665f4d3b8f4c8a001f5f0a16';
  const session = {
    withTransaction: async (work: (value: unknown) => Promise<void>) =>
      work(session),
    endSession: jest.fn(),
  };
  const member = {
    _id: objectId(memberId),
    fullName: 'Ada Lovelace',
    memberNumber: 'MEM-0001',
    membershipTypeId: objectId(membershipTypeId),
    status: MemberStatus.Active,
    activeLoanCount: 0,
    save: jest.fn().mockResolvedValue(undefined),
  };
  const book = {
    _id: objectId(bookId),
    categoryId: objectId(categoryId),
    title: 'Refactoring',
    catalogIdentifier: 'BK-1003',
    status: LibraryItemStatus.Active,
    availableQuantity: 2,
    save: jest.fn().mockResolvedValue(undefined),
  };
  const category = {
    _id: objectId(categoryId),
    status: LibraryItemStatus.Active,
    loanPeriodDays: 14,
  };
  const membershipType = {
    _id: objectId(membershipTypeId),
    status: LibraryItemStatus.Active,
    maxActiveLoans: 3,
  };
  let createdBorrowing: Record<string, unknown> = {};
  const borrowingModel = jest.fn().mockImplementation((document) => {
    const created = {
      ...document,
      _id: objectId(borrowingId),
      id: borrowingId,
    };
    createdBorrowing = {
      ...created,
      save: options.borrowingSave ?? jest.fn().mockResolvedValue(created),
    };
    return createdBorrowing;
  }) as unknown as Record<string, unknown>;
  const overdueQuery = {
    session: jest.fn().mockResolvedValue(null),
  };
  (borrowingModel as { exists: jest.Mock }).exists = jest
    .fn()
    .mockReturnValue(overdueQuery);
  const memberQuery = createSessionQuery(member);
  const bookQuery = createSessionQuery(book);
  const categoryQuery = createSessionQuery(category);
  const membershipTypeQuery = createSessionQuery(membershipType);
  const rulesService = new BorrowingsRulesService();
  jest.spyOn(rulesService, 'assertCanBorrow');

  return {
    memberId,
    bookId,
    borrowingId,
    session,
    member,
    book,
    category,
    membershipType,
    memberQuery,
    bookQuery,
    categoryQuery,
    membershipTypeQuery,
    overdueQuery,
    rulesService,
    get createdBorrowing() {
      return createdBorrowing;
    },
    borrowingModel,
    dependencies: {
      connection: {
        startSession: jest.fn().mockResolvedValue(session),
      },
      bookModel: { findOne: jest.fn().mockReturnValue(bookQuery) },
      bookCategoryModel: {
        findOne: jest.fn().mockReturnValue(categoryQuery),
      },
      memberModel: {
        findOne: jest.fn().mockReturnValue(memberQuery),
      },
      membershipTypeModel: {
        findOne: jest.fn().mockReturnValue(membershipTypeQuery),
      },
      rulesService,
    },
  };
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
