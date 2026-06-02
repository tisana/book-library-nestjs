import mongoose from 'mongoose';

import {
  LibraryItemStatus,
  LoanState,
  MemberStatus,
} from '../src/common/enums/library-status.enum';

const DEMO_ACTOR_ID = 'demo-seed';
const DAY_MS = 24 * 60 * 60 * 1000;

type SeededDocument = {
  _id: mongoose.Types.ObjectId;
};

function getMongoUri(): string {
  return process.env.MONGODB_URI ?? 'mongodb://localhost:27017/bookstore';
}

function daysFrom(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

async function ensureIndexes(): Promise<void> {
  await Promise.all([
    mongoose.connection
      .collection('bookcategories')
      .createIndex({ code: 1 }, { unique: true }),
    mongoose.connection
      .collection('books')
      .createIndex({ catalogIdentifier: 1 }, { unique: true }),
    mongoose.connection
      .collection('books')
      .createIndex({ isbn: 1 }, { unique: true, sparse: true }),
    mongoose.connection
      .collection('membershiptypes')
      .createIndex({ code: 1 }, { unique: true }),
    mongoose.connection
      .collection('members')
      .createIndex({ memberNumber: 1 }, { unique: true }),
    mongoose.connection
      .collection('members')
      .createIndex({ email: 1 }, { unique: true, sparse: true }),
    mongoose.connection.collection('borrowings').createIndex({ memberId: 1 }),
    mongoose.connection.collection('borrowings').createIndex({ bookId: 1 }),
    mongoose.connection
      .collection('borrowings')
      .createIndex({ status: 1, dueAt: 1 }),
  ]);
}

async function upsertDocument(
  collectionName: string,
  filter: Record<string, unknown>,
  fields: Record<string, unknown>,
  now: Date,
): Promise<SeededDocument> {
  const collection = mongoose.connection.collection(collectionName);

  await collection.updateOne(
    filter,
    {
      $set: {
        ...fields,
        updatedBy: DEMO_ACTOR_ID,
        updatedAt: now,
      },
      $setOnInsert: {
        createdBy: DEMO_ACTOR_ID,
        createdAt: now,
      },
    },
    { upsert: true },
  );

  const document = await collection.findOne(filter);
  if (!document) {
    throw new Error(
      `Failed to load seeded document from ${collectionName}: ${JSON.stringify(
        filter,
      )}`,
    );
  }

  return document as SeededDocument;
}

async function seedDemoData(): Promise<void> {
  const now = new Date();
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);

  const categories = {
    standard: await upsertDocument(
      'bookcategories',
      { code: 'STANDARD' },
      {
        code: 'STANDARD',
        name: 'Standard Collection',
        loanPeriodDays: 14,
        status: LibraryItemStatus.Active,
      },
      now,
    ),
    shortLoan: await upsertDocument(
      'bookcategories',
      { code: 'SHORT' },
      {
        code: 'SHORT',
        name: 'Short Loan Collection',
        loanPeriodDays: 7,
        status: LibraryItemStatus.Active,
      },
      now,
    ),
    reference: await upsertDocument(
      'bookcategories',
      { code: 'REFERENCE' },
      {
        code: 'REFERENCE',
        name: 'Reference Only',
        loanPeriodDays: 1,
        status: LibraryItemStatus.Deactivated,
      },
      now,
    ),
  };

  const membershipTypes = {
    standard: await upsertDocument(
      'membershiptypes',
      { code: 'STANDARD' },
      {
        code: 'STANDARD',
        name: 'Standard Member',
        maxActiveLoans: 3,
        status: LibraryItemStatus.Active,
      },
      now,
    ),
    premium: await upsertDocument(
      'membershiptypes',
      { code: 'PREMIUM' },
      {
        code: 'PREMIUM',
        name: 'Premium Member',
        maxActiveLoans: 5,
        status: LibraryItemStatus.Active,
      },
      now,
    ),
  };

  const books = {
    cleanCode: await upsertDocument(
      'books',
      { catalogIdentifier: 'BK-1001' },
      {
        catalogIdentifier: 'BK-1001',
        title: 'Clean Code',
        author: 'Robert C. Martin',
        isbn: '9780132350884',
        categoryId: categories.standard._id,
        totalQuantity: 3,
        availableQuantity: 2,
        status: LibraryItemStatus.Active,
      },
      now,
    ),
    domainDrivenDesign: await upsertDocument(
      'books',
      { catalogIdentifier: 'BK-1002' },
      {
        catalogIdentifier: 'BK-1002',
        title: 'Domain-Driven Design',
        author: 'Eric Evans',
        isbn: '9780321125217',
        categoryId: categories.standard._id,
        totalQuantity: 2,
        availableQuantity: 2,
        status: LibraryItemStatus.Active,
      },
      now,
    ),
    refactoring: await upsertDocument(
      'books',
      { catalogIdentifier: 'BK-1003' },
      {
        catalogIdentifier: 'BK-1003',
        title: 'Refactoring',
        author: 'Martin Fowler',
        isbn: '9780134757599',
        categoryId: categories.shortLoan._id,
        totalQuantity: 1,
        availableQuantity: 0,
        status: LibraryItemStatus.Active,
      },
      now,
    ),
    referenceHandbook: await upsertDocument(
      'books',
      { catalogIdentifier: 'BK-1004' },
      {
        catalogIdentifier: 'BK-1004',
        title: 'Architecture Reference Handbook',
        author: 'Library Desk',
        categoryId: categories.reference._id,
        totalQuantity: 1,
        availableQuantity: 0,
        status: LibraryItemStatus.Deactivated,
      },
      now,
    ),
    limitA: await upsertDocument(
      'books',
      { catalogIdentifier: 'BK-1005' },
      {
        catalogIdentifier: 'BK-1005',
        title: 'Limit Demo Book A',
        author: 'Library Demo',
        categoryId: categories.standard._id,
        totalQuantity: 1,
        availableQuantity: 0,
        status: LibraryItemStatus.Active,
      },
      now,
    ),
    limitB: await upsertDocument(
      'books',
      { catalogIdentifier: 'BK-1006' },
      {
        catalogIdentifier: 'BK-1006',
        title: 'Limit Demo Book B',
        author: 'Library Demo',
        categoryId: categories.standard._id,
        totalQuantity: 1,
        availableQuantity: 0,
        status: LibraryItemStatus.Active,
      },
      now,
    ),
    limitC: await upsertDocument(
      'books',
      { catalogIdentifier: 'BK-1007' },
      {
        catalogIdentifier: 'BK-1007',
        title: 'Limit Demo Book C',
        author: 'Library Demo',
        categoryId: categories.standard._id,
        totalQuantity: 1,
        availableQuantity: 0,
        status: LibraryItemStatus.Active,
      },
      now,
    ),
  };

  const members = {
    jane: await upsertDocument(
      'members',
      { memberNumber: 'M-1001' },
      {
        memberNumber: 'M-1001',
        fullName: 'Jane Reader',
        email: 'jane.reader@example.test',
        phone: '+66020001001',
        membershipTypeId: membershipTypes.standard._id,
        status: MemberStatus.Active,
        activeLoanCount: 1,
      },
      now,
    ),
    max: await upsertDocument(
      'members',
      { memberNumber: 'M-1002' },
      {
        memberNumber: 'M-1002',
        fullName: 'Max Limit',
        email: 'max.limit@example.test',
        phone: '+66020001002',
        membershipTypeId: membershipTypes.standard._id,
        status: MemberStatus.Active,
        activeLoanCount: 3,
      },
      now,
    ),
    sam: await upsertDocument(
      'members',
      { memberNumber: 'M-1003' },
      {
        memberNumber: 'M-1003',
        fullName: 'Sam Suspended',
        email: 'sam.suspended@example.test',
        phone: '+66020001003',
        membershipTypeId: membershipTypes.standard._id,
        status: MemberStatus.Suspended,
        activeLoanCount: 0,
      },
      now,
    ),
    olivia: await upsertDocument(
      'members',
      { memberNumber: 'M-1004' },
      {
        memberNumber: 'M-1004',
        fullName: 'Olivia Overdue',
        email: 'olivia.overdue@example.test',
        phone: '+66020001004',
        membershipTypeId: membershipTypes.premium._id,
        status: MemberStatus.Active,
        activeLoanCount: 1,
      },
      now,
    ),
  };

  const borrowingCollection = mongoose.connection.collection('borrowings');
  await borrowingCollection.deleteMany({ borrowedByStaffId: DEMO_ACTOR_ID });
  await borrowingCollection.insertMany([
    {
      memberId: members.jane._id,
      bookId: books.cleanCode._id,
      bookCategoryId: categories.standard._id,
      borrowedAt: daysFrom(today, -2),
      dueAt: daysFrom(today, 12),
      status: LoanState.Active,
      borrowedByStaffId: DEMO_ACTOR_ID,
      createdAt: now,
      updatedAt: now,
    },
    {
      memberId: members.jane._id,
      bookId: books.domainDrivenDesign._id,
      bookCategoryId: categories.standard._id,
      borrowedAt: daysFrom(today, -20),
      dueAt: daysFrom(today, -6),
      returnedAt: daysFrom(today, -10),
      status: LoanState.Returned,
      borrowedByStaffId: DEMO_ACTOR_ID,
      returnedByStaffId: DEMO_ACTOR_ID,
      createdAt: now,
      updatedAt: now,
    },
    {
      memberId: members.olivia._id,
      bookId: books.refactoring._id,
      bookCategoryId: categories.shortLoan._id,
      borrowedAt: daysFrom(today, -21),
      dueAt: daysFrom(today, -14),
      status: LoanState.Overdue,
      borrowedByStaffId: DEMO_ACTOR_ID,
      createdAt: now,
      updatedAt: now,
    },
    {
      memberId: members.max._id,
      bookId: books.limitA._id,
      bookCategoryId: categories.standard._id,
      borrowedAt: daysFrom(today, -1),
      dueAt: daysFrom(today, 13),
      status: LoanState.Active,
      borrowedByStaffId: DEMO_ACTOR_ID,
      createdAt: now,
      updatedAt: now,
    },
    {
      memberId: members.max._id,
      bookId: books.limitB._id,
      bookCategoryId: categories.standard._id,
      borrowedAt: daysFrom(today, -1),
      dueAt: daysFrom(today, 13),
      status: LoanState.Active,
      borrowedByStaffId: DEMO_ACTOR_ID,
      createdAt: now,
      updatedAt: now,
    },
    {
      memberId: members.max._id,
      bookId: books.limitC._id,
      bookCategoryId: categories.standard._id,
      borrowedAt: daysFrom(today, -1),
      dueAt: daysFrom(today, 13),
      status: LoanState.Active,
      borrowedByStaffId: DEMO_ACTOR_ID,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  console.log('Seeded demo categories: STANDARD, SHORT, REFERENCE');
  console.log('Seeded demo membership types: STANDARD, PREMIUM');
  console.log(
    'Seeded demo books: BK-1001, BK-1002, BK-1003, BK-1004, BK-1005, BK-1006, BK-1007',
  );
  console.log('Seeded demo members: M-1001, M-1002, M-1003, M-1004');
  console.log('Seeded demo borrowings: 6 records');
}

async function main(): Promise<void> {
  const mongoUri = getMongoUri();

  await mongoose.connect(mongoUri, {
    directConnection: true,
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await ensureIndexes();
    await seedDemoData();
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error('Failed to seed demo data');
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
