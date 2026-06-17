import { MigrationDefinition } from '../migrate';

export const migrationRecordCollection = 'migration_records';

export interface MigrationRecord {
  version: string;
  name: string;
  rollbackNotes: string[];
  appliedAt: Date;
}

export const migration: MigrationDefinition = {
  version: '000',
  name: 'migration-record',
  rollbackNotes: [
    'Drop the migration_records collection only when intentionally resetting migration history.',
  ],
  async up({ connection }) {
    await connection
      .collection(migrationRecordCollection)
      .createIndex({ version: 1 }, { unique: true });
  },
};
