import { BorrowingsRulesService } from './borrowings-rules.service';
import { BorrowingsService } from './borrowings.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  LibraryItemStatus,
  LoanState,
  MemberStatus,
} from '../common/enums/library-status.enum';
import { BorrowingQueryDto } from './dto/borrowing.dto';
import { createBorrowingDocument as createSharedBorrowingDocument } from '../../test/support/critical-auth-fixtures';

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
    ).rejects.toMatchObject({
      message: 'Authenticated staff actor is required',
    });
  });

  it('requires an authenticated staff actor before returning borrowing records', async () => {
    const service = createService();

    await expect(service.returnBorrowing('borrowing-id')).rejects.toMatchObject(
      {
        message: 'Authenticated staff actor is required',
      },
    );
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
    ).rejects.toMatchObject({
      message: 'Member id must come from the token',
    });
  });

  it('accepts an explicit member filter only when it matches the authenticated owner', async () => {
    const memberId = '665f4d3b8f4c8a001f5f0a12';
    const queryBuilder = createFindQuery([]);
    const find = jest.fn().mockReturnValue(queryBuilder);
    const service = createService({ find });

    await expect(
      service.findByMember(memberId, {
        memberId,
        page: 1,
        limit: 20,
      }),
    ).resolves.toStrictEqual([]);

    const filter = find.mock.calls[0][0] as {
      memberId: { $eq: { toHexString: () => string } };
    };
    expect(filter.memberId.$eq.toHexString()).toBe(memberId);
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
    const overdueFilter = (fixture.borrowingModel as { exists: jest.Mock })
      .exists.mock.calls[0][0] as {
      memberId: { $eq: { toHexString: () => string } };
      returnedAt: { $exists: boolean };
      status: { $in: LoanState[] };
      dueAt: { $lt: Date };
    };
    expect(overdueFilter.memberId.$eq.toHexString()).toBe(fixture.memberId);
    expect(overdueFilter).toStrictEqual({
      memberId: { $eq: overdueFilter.memberId.$eq },
      returnedAt: { $exists: false },
      status: { $in: [LoanState.Active, LoanState.Overdue] },
      dueAt: { $lt: expect.any(Date) },
    });
    expect(fixture.createdBorrowing.save).toHaveBeenCalledWith({
      session: fixture.session,
    });
    expect(fixture.book.save).toHaveBeenCalledWith({
      session: fixture.session,
    });
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
    expect(borrowing.save).toHaveBeenCalledWith({ session: fixture.session });
    expect(fixture.book.save).toHaveBeenCalledWith({
      session: fixture.session,
    });
    expect(fixture.member.save).toHaveBeenCalledWith({
      session: fixture.session,
    });
  });

  it('returns an overdue loan at the supplied time without a negative loan count', async () => {
    const returnedAt = '2026-07-31T05:00:00.000Z';
    const fixture = createBorrowingLifecycleFixture({
      existingBorrowing: {
        id: undefined,
        status: LoanState.Overdue,
        save: jest.fn().mockResolvedValue(undefined),
      },
    });
    const service = createService(fixture.borrowingModel, fixture.dependencies);

    const result = await service.returnBorrowing(
      fixture.borrowingId,
      { returnedAt },
      actor,
    );

    expect(result.returnedAt).toBe(returnedAt);
    expect(result.id).toBe(fixture.borrowingId);
    expect(fixture.member.activeLoanCount).toBe(0);
    expect(fixture.book.availableQuantity).toBe(3);
  });

  it('denies a non-returned loan in an illegal state without writes', async () => {
    const borrowingSave = jest.fn();
    const fixture = createBorrowingLifecycleFixture({
      existingBorrowing: {
        status: LoanState.Cancelled,
        returnedAt: undefined,
        save: borrowingSave,
      },
    });
    const service = createService(fixture.borrowingModel, fixture.dependencies);

    await expect(
      service.returnBorrowing(fixture.borrowingId, {}, actor),
    ).rejects.toMatchObject({ message: 'Borrowing record cannot be returned' });

    expect(borrowingSave).not.toHaveBeenCalled();
    expect(fixture.book.save).not.toHaveBeenCalled();
    expect(fixture.member.save).not.toHaveBeenCalled();
    expect(fixture.session.endSession).toHaveBeenCalledTimes(1);
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
    ).rejects.toMatchObject({
      message: 'Borrowing record has already been returned',
    });

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

  it('applies exact book and status filters without widening the list query', async () => {
    const queryBuilder = createFindQuery([]);
    const find = jest.fn().mockReturnValue(queryBuilder);
    const service = createService({ find });
    const bookId = '665f4d3b8f4c8a001f5f0a13';

    await service.findAll({
      bookId,
      status: LoanState.Returned,
      page: 1,
      limit: 20,
    });

    const filter = find.mock.calls[0][0] as {
      bookId: { $eq: { toHexString: () => string } };
      status: { $eq: LoanState };
    };
    expect(filter.bookId.$eq.toHexString()).toBe(bookId);
    expect(filter.status).toStrictEqual({ $eq: LoanState.Returned });
    expect(Object.keys(filter).sort()).toStrictEqual(['bookId', 'status']);
  });

  it.each([
    [
      'memberId',
      { memberId: 'not-a-member-id', page: 1, limit: 20 },
      'memberId must be a valid MongoDB ObjectId',
    ],
    [
      'bookId',
      { bookId: 'not-a-book-id', page: 1, limit: 20 },
      'bookId must be a valid MongoDB ObjectId',
    ],
  ])(
    'reports the exact %s field when a list identifier is malformed',
    async (_field, query, message) => {
      const find = jest.fn();
      const service = createService({ find });

      await expect(service.findAll(query)).rejects.toMatchObject({ message });
      expect(find).not.toHaveBeenCalled();
    },
  );

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
    const query = createFindQuery(
      createBorrowingDocument({
        _id: objectId(borrowingId),
        id: borrowingId,
      }),
    );
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
    const query = createFindQuery(
      createBorrowingDocument({
        _id: objectId(borrowingId),
        id: borrowingId,
        memberId: objectId(memberId),
      }),
    );
    const findOne = jest.fn().mockReturnValue(query);
    const service = createService({ findOne });

    await expect(
      service.findOneForMember(borrowingId, memberId),
    ).resolves.toMatchObject({
      id: borrowingId,
      memberId,
    });

    const filter = findOne.mock.calls[0][0] as {
      _id: { $eq: { toHexString: () => string } };
      memberId: { $eq: { toHexString: () => string } };
    };
    expect(filter._id.$eq.toHexString()).toBe(borrowingId);
    expect(filter.memberId.$eq.toHexString()).toBe(memberId);
    expect(query.populate).toHaveBeenNthCalledWith(1, 'bookId');
    expect(query.populate).toHaveBeenNthCalledWith(2, 'memberId');
  });

  it('reports the member ownership field for malformed self-service detail input', async () => {
    const findOne = jest.fn();
    const service = createService({ findOne });

    await expect(
      service.findOneForMember('665f4d3b8f4c8a001f5f0a14', 'not-a-member-id'),
    ).rejects.toMatchObject({
      message: 'memberId must be a valid MongoDB ObjectId',
    });
    expect(findOne).not.toHaveBeenCalled();
  });

  it.each([
    [new Date('2026-06-10T00:00:00.000Z'), LoanState.Active],
    [undefined, LoanState.Returned],
  ])(
    'rejects either persisted returned marker (%s, %s) before any side effect',
    async (returnedAt, status) => {
      const fixture = createBorrowingLifecycleFixture({
        existingBorrowing: {
          returnedAt,
          status,
          save: jest.fn(),
        },
      });
      const service = createService(
        fixture.borrowingModel,
        fixture.dependencies,
      );

      await expect(
        service.returnBorrowing(fixture.borrowingId, {}, actor),
      ).rejects.toMatchObject({
        message: 'Borrowing record has already been returned',
      });

      expect(fixture.book.save).not.toHaveBeenCalled();
      expect(fixture.member.save).not.toHaveBeenCalled();
      expect(fixture.session.endSession).toHaveBeenCalledTimes(1);
    },
  );

  it('returns the exact transactional not-found contract when the borrowing is absent', async () => {
    const fixture = createBorrowingLifecycleFixture();
    (fixture.borrowingModel as { findOne: jest.Mock }).findOne = jest
      .fn()
      .mockReturnValue(createSessionQuery(null));
    const service = createService(fixture.borrowingModel, fixture.dependencies);

    await expect(
      service.returnBorrowing(fixture.borrowingId, {}, actor),
    ).rejects.toMatchObject({ message: 'Borrowing record not found' });

    expect(fixture.bookQuery.exec).not.toHaveBeenCalled();
    expect(fixture.memberQuery.exec).not.toHaveBeenCalled();
    expect(fixture.session.endSession).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['member', 'memberQuery', 'Member not found'],
    ['book', 'bookQuery', 'Book not found'],
    ['category', 'categoryQuery', 'Book category not found'],
    ['membership type', 'membershipTypeQuery', 'Membership type not found'],
  ])(
    'stops borrowing creation at a missing %s with the exact public contract',
    async (_label, queryName, message) => {
      const fixture = createBorrowingLifecycleFixture();
      const query =
        fixture[
          queryName as
            | 'memberQuery'
            | 'bookQuery'
            | 'categoryQuery'
            | 'membershipTypeQuery'
        ];
      query.exec.mockResolvedValue(null);
      const service = createService(
        fixture.borrowingModel,
        fixture.dependencies,
      );

      await expect(
        service.create(
          { memberId: fixture.memberId, bookId: fixture.bookId },
          actor,
        ),
      ).rejects.toMatchObject({ message });

      expect(fixture.createdBorrowing).toStrictEqual({});
      expect(fixture.book.save).not.toHaveBeenCalled();
      expect(fixture.member.save).not.toHaveBeenCalled();
      expect(fixture.session.endSession).toHaveBeenCalledTimes(1);
    },
  );

  it('reports the overdue member-id field when persisted ownership is malformed', async () => {
    const fixture = createBorrowingLifecycleFixture();
    fixture.member._id = objectId('not-a-member-id');
    const service = createService(fixture.borrowingModel, fixture.dependencies);

    await expect(
      service.create(
        { memberId: fixture.memberId, bookId: fixture.bookId },
        actor,
      ),
    ).rejects.toMatchObject({
      message: 'memberId must be a valid MongoDB ObjectId',
    });

    expect(
      (fixture.borrowingModel as { exists: jest.Mock }).exists,
    ).not.toHaveBeenCalled();
    expect(fixture.createdBorrowing).toStrictEqual({});
  });

  it.each([
    ['bookId', 'book', 'bookId must be a valid MongoDB ObjectId'],
    ['memberId', 'member', 'memberId must be a valid MongoDB ObjectId'],
  ])(
    'reports the exact %s field when a persisted borrowing reference is malformed',
    async (_field, reference, message) => {
      const fixture = createBorrowingLifecycleFixture({
        existingBorrowing: {
          bookId:
            reference === 'book'
              ? objectId('not-a-book-id')
              : objectId('665f4d3b8f4c8a001f5f0a13'),
          memberId:
            reference === 'member'
              ? objectId('not-a-member-id')
              : objectId('665f4d3b8f4c8a001f5f0a12'),
        },
      });
      const service = createService(
        fixture.borrowingModel,
        fixture.dependencies,
      );

      await expect(
        service.returnBorrowing(fixture.borrowingId, {}, actor),
      ).rejects.toMatchObject({ message });
      expect(fixture.book.save).not.toHaveBeenCalled();
      expect(fixture.member.save).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['categoryId', 'category', 'categoryId must be a valid MongoDB ObjectId'],
    [
      'membershipTypeId',
      'membership',
      'membershipTypeId must be a valid MongoDB ObjectId',
    ],
  ])(
    'reports the exact %s field when a persisted creation reference is malformed',
    async (_field, reference, message) => {
      const fixture = createBorrowingLifecycleFixture();
      if (reference === 'category') {
        fixture.book.categoryId = objectId('not-a-category-id');
      } else {
        fixture.member.membershipTypeId = objectId('not-a-membership-id');
      }
      const service = createService(
        fixture.borrowingModel,
        fixture.dependencies,
      );

      await expect(
        service.create(
          { memberId: fixture.memberId, bookId: fixture.bookId },
          actor,
        ),
      ).rejects.toMatchObject({ message });
      expect(fixture.createdBorrowing).toStrictEqual({});
    },
  );

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

function createBorrowingLifecycleFixture(
  options: {
    borrowingSave?: jest.Mock;
    existingBorrowing?: Record<string, unknown>;
  } = {},
) {
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
  if (options.existingBorrowing) {
    const existingBorrowing = createSharedBorrowingDocument({
      _id: objectId(borrowingId),
      id: borrowingId,
      memberId: member._id,
      bookId: book._id,
      bookCategoryId: category._id,
      ...options.existingBorrowing,
    } as never);
    (borrowingModel as { findOne: jest.Mock }).findOne = jest
      .fn()
      .mockImplementation((filter: Record<string, unknown>) => {
        const requestedId = (
          filter._id as { $eq?: { toHexString?: () => string } } | undefined
        )?.$eq?.toHexString?.();
        return createSessionQuery(
          requestedId === borrowingId ? existingBorrowing : null,
        );
      });
  }
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
      bookModel: {
        findOne: jest
          .fn()
          .mockImplementation((filter: Record<string, unknown>) => {
            const requestedId = (
              filter._id as { $eq?: { toHexString?: () => string } } | undefined
            )?.$eq?.toHexString?.();
            return requestedId === bookId
              ? bookQuery
              : createSessionQuery(null);
          }),
      },
      bookCategoryModel: {
        findOne: jest
          .fn()
          .mockImplementation((filter: Record<string, unknown>) => {
            const requestedId = (
              filter._id as { $eq?: { toHexString?: () => string } } | undefined
            )?.$eq?.toHexString?.();
            return requestedId === categoryId
              ? categoryQuery
              : createSessionQuery(null);
          }),
      },
      memberModel: {
        findOne: jest
          .fn()
          .mockImplementation((filter: Record<string, unknown>) => {
            const requestedId = (
              filter._id as { $eq?: { toHexString?: () => string } } | undefined
            )?.$eq?.toHexString?.();
            return requestedId === memberId
              ? memberQuery
              : createSessionQuery(null);
          }),
      },
      membershipTypeModel: {
        findOne: jest
          .fn()
          .mockImplementation((filter: Record<string, unknown>) => {
            const requestedId = (
              filter._id as { $eq?: { toHexString?: () => string } } | undefined
            )?.$eq?.toHexString?.();
            return requestedId === membershipTypeId
              ? membershipTypeQuery
              : createSessionQuery(null);
          }),
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
