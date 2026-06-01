import { MigrationDefinition } from '../migrate';

export const migration: MigrationDefinition = {
  version: '001',
  name: 'library-core',
  rollbackNotes: [
    'Drop staff user indexes only after confirming no deployed code relies on them.',
  ],
  async up({ connection, session }) {
    const staffUsers = connection.collection('staffusers');
    const books = connection.collection('books');
    const bookCategories = connection.collection('bookcategories');
    const membershipTypes = connection.collection('membershiptypes');
    const members = connection.collection('members');
    const borrowings = connection.collection('borrowings');

    await staffUsers.createIndex({ email: 1 }, { unique: true, session });
    await staffUsers.createIndex({ status: 1, roles: 1 }, { session });
    await bookCategories.createIndex({ code: 1 }, { unique: true, session });
    await bookCategories.createIndex({ status: 1 }, { session });
    await books.createIndex({ catalogIdentifier: 1 }, { unique: true, session });
    await books.createIndex({ isbn: 1 }, { unique: true, sparse: true, session });
    await books.createIndex({ title: 1 }, { session });
    await books.createIndex({ author: 1 }, { session });
    await books.createIndex({ status: 1 }, { session });
    await books.createIndex({ categoryId: 1 }, { session });
    await membershipTypes.createIndex({ code: 1 }, { unique: true, session });
    await membershipTypes.createIndex({ status: 1 }, { session });
    await members.createIndex({ memberNumber: 1 }, { unique: true, session });
    await members.createIndex(
      { email: 1 },
      { unique: true, sparse: true, session },
    );
    await members.createIndex({ status: 1, membershipTypeId: 1 }, { session });
    await borrowings.createIndex({ memberId: 1, status: 1 }, { session });
    await borrowings.createIndex({ bookId: 1, status: 1 }, { session });
    await borrowings.createIndex({ dueAt: 1, status: 1 }, { session });
  },
};
