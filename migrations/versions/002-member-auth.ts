import { MigrationDefinition } from '../migrate';

export const migration: MigrationDefinition = {
  version: '002',
  name: 'member-auth',
  rollbackNotes: [
    'Drop the members loginIdentifier unique sparse index only after member self-service login is disabled or replaced.',
    'Unset members loginIdentifier, passwordHash, passwordUpdatedAt, lastLoginAt, and authStatus only after confirming no member tokens or login flows depend on them.',
    'Keep member documents and borrowing history intact; rollback must not delete members or borrowings.',
    'Drop the borrowings memberId/status/dueAt index only after confirming member self-service borrowing queries no longer use it.',
  ],
  async up({ connection }) {
    const members = connection.collection('members');
    const borrowings = connection.collection('borrowings');

    await members.createIndex(
      { loginIdentifier: 1 },
      { unique: true, sparse: true },
    );
    await members.createIndex({ authStatus: 1 });
    await borrowings.createIndex(
      { memberId: 1, status: 1, dueAt: 1 },
    );
  },
};
