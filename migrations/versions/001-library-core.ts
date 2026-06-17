import { MigrationDefinition } from '../migrate';

export const migration: MigrationDefinition = {
  version: '001',
  name: 'library-core',
  rollbackNotes: [
    'Drops for this migration must be reviewed per collection because deployed code depends on these indexes for auth, catalog, membership, and borrowing queries.',
    'If rollback is required, drop the staffusers email and status/roles indexes only after confirming no staff login or authorization flow depends on them.',
    'Drop bookcategories, books, membershiptypes, members, and borrowings indexes only after confirming replacement indexes or older code paths are deployed.',
    'Do not drop collections as part of rollback; borrowing history and audit-related records must be preserved unless an explicit data-retention decision is approved.',
  ],
  async up({ connection }) {
    const staffUsers = connection.collection('staffusers');
    const books = connection.collection('books');
    const bookCategories = connection.collection('bookcategories');
    const membershipTypes = connection.collection('membershiptypes');
    const members = connection.collection('members');
    const borrowings = connection.collection('borrowings');

    await staffUsers.createIndex({ email: 1 }, { unique: true });
    await staffUsers.createIndex({ status: 1, roles: 1 });
    await bookCategories.createIndex({ code: 1 }, { unique: true });
    await bookCategories.createIndex({ status: 1 });
    await books.createIndex({ catalogIdentifier: 1 }, { unique: true });
    await books.createIndex({ isbn: 1 }, { unique: true, sparse: true });
    await books.createIndex({ title: 1 });
    await books.createIndex({ author: 1 });
    await books.createIndex({ status: 1 });
    await books.createIndex({ categoryId: 1 });
    await membershipTypes.createIndex({ code: 1 }, { unique: true });
    await membershipTypes.createIndex({ status: 1 });
    await members.createIndex({ memberNumber: 1 }, { unique: true });
    await members.createIndex(
      { email: 1 },
      { unique: true, sparse: true },
    );
    await members.createIndex({ status: 1, membershipTypeId: 1 });
    await borrowings.createIndex({ memberId: 1, status: 1 });
    await borrowings.createIndex({ bookId: 1, status: 1 });
    await borrowings.createIndex({ dueAt: 1, status: 1 });
  },
};
