import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { BorrowingsModule } from '../src/borrowings/borrowings.module';
import { BorrowingsService } from '../src/borrowings/borrowings.service';
import {
  LibraryItemStatus,
  LoanState,
  MemberStatus,
  StaffRole,
} from '../src/common/enums/library-status.enum';
import {
  BookCategoryDocument,
  BookCategoryModelName,
} from '../src/book-categories/schemas/book-category.schema';
import { BookDocument, BookModelName } from '../src/books/schemas/book.schema';
import {
  MemberDocument,
  MemberModelName,
} from '../src/members/schemas/member.schema';
import {
  MembershipTypeDocument,
  MembershipTypeModelName,
} from '../src/membership-types/schemas/membership-type.schema';
import {
  BorrowingDocument,
  BorrowingModelName,
} from '../src/borrowings/schemas/borrowing.schema';

describe('Borrowing transaction consistency (e2e)', () => {
  jest.setTimeout(120000);

  let replSet: MongoMemoryReplSet;
  let app: INestApplication;
  let service: BorrowingsService;
  let bookModel: Model<BookDocument>;
  let categoryModel: Model<BookCategoryDocument>;
  let memberModel: Model<MemberDocument>;
  let membershipTypeModel: Model<MembershipTypeDocument>;
  let borrowingModel: Model<BorrowingDocument>;

  const actor = {
    id: 'staff-user-id',
    email: 'staff@example.com',
    roles: [StaffRole.Staff],
  };

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(replSet.getUri()), BorrowingsModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    service = moduleFixture.get(BorrowingsService);
    bookModel = moduleFixture.get(getModelToken(BookModelName));
    categoryModel = moduleFixture.get(getModelToken(BookCategoryModelName));
    memberModel = moduleFixture.get(getModelToken(MemberModelName));
    membershipTypeModel = moduleFixture.get(
      getModelToken(MembershipTypeModelName),
    );
    borrowingModel = moduleFixture.get(getModelToken(BorrowingModelName));
  });

  afterAll(async () => {
    await app.close();
    await replSet.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      borrowingModel.deleteMany({}),
      bookModel.deleteMany({}),
      categoryModel.deleteMany({}),
      memberModel.deleteMany({}),
      membershipTypeModel.deleteMany({}),
    ]);
  });

  async function seedBorrowableFixture() {
    const category = await categoryModel.create({
      code: 'STANDARD',
      name: 'Standard Collection',
      loanPeriodDays: 14,
      status: LibraryItemStatus.Active,
    });
    const membershipType = await membershipTypeModel.create({
      code: 'STANDARD',
      name: 'Standard Member',
      maxActiveLoans: 100,
      status: LibraryItemStatus.Active,
    });
    const member = await memberModel.create({
      memberNumber: 'M-1001',
      fullName: 'Jane Reader',
      membershipTypeId: membershipType._id,
      status: MemberStatus.Active,
      activeLoanCount: 0,
    });
    const book = await bookModel.create({
      title: 'Clean Code',
      catalogIdentifier: 'BK-1001',
      categoryId: category._id,
      totalQuantity: 1,
      availableQuantity: 1,
      status: LibraryItemStatus.Active,
    });

    return { book, member };
  }

  it('keeps book availability and member active loan count consistent across 100 borrow/return transactions', async () => {
    const { book, member } = await seedBorrowableFixture();

    for (let i = 0; i < 100; i += 1) {
      const borrowing = await service.create(
        {
          memberId: member._id.toString(),
          bookId: book._id.toString(),
        },
        actor,
      );

      await expect(
        service.returnBorrowing(borrowing.id, {}, actor),
      ).resolves.toMatchObject({
        id: borrowing.id,
        status: LoanState.Returned,
      });
    }

    await expect(
      bookModel.findById(book._id).lean().exec(),
    ).resolves.toMatchObject({
      availableQuantity: 1,
    });
    await expect(
      memberModel.findById(member._id).lean().exec(),
    ).resolves.toMatchObject({
      activeLoanCount: 0,
    });
    await expect(
      borrowingModel.countDocuments({ status: LoanState.Returned }),
    ).resolves.toBe(100);
  });
});
