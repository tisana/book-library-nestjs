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
  },
};
