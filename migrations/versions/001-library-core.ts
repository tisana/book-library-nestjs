import { MigrationDefinition } from '../migrate';
import * as bcrypt from 'bcryptjs';

export const migration: MigrationDefinition = {
  version: '001',
  name: 'library-core',
  rollbackNotes: [
    'Drop staff user indexes only after confirming no deployed code relies on them.',
    'Remove the seeded initial admin only if no operational access depends on it.',
  ],
  async up({ connection, session }) {
    const staffUsers = connection.collection('staffusers');

    await staffUsers.createIndex({ email: 1 }, { unique: true, session });
    await staffUsers.createIndex({ status: 1, roles: 1 }, { session });

    const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase();
    const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD;

    if (initialAdminEmail && initialAdminPassword) {
      await staffUsers.insertOne(
        {
          email: initialAdminEmail,
          displayName: process.env.INITIAL_ADMIN_NAME ?? 'Library Admin',
          passwordHash: await bcrypt.hash(initialAdminPassword, 12),
          roles: ['admin'],
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { session },
      );
    }
  },
};
