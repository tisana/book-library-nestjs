# Migrations

MongoDB schema/index/reference-data changes are applied through versioned migration files in `migrations/versions`.

## Commands

```bash
npm run migrate:status
npm run migrate:up
```

Both commands read `MONGODB_URI`. If it is not set, the runner uses `mongodb://localhost:27017/bookstore`.

## Migration File Contract

Each file should be named with an ordered numeric prefix, for example `001-library-core.ts`, and export `migration` or a default `MigrationDefinition`:

```ts
import { MigrationDefinition } from '../migrate';

export const migration: MigrationDefinition = {
  version: '001',
  name: 'library-core',
  rollbackNotes: [
    'Describe the manual rollback steps for every collection, index, or seed change.',
  ],
  async up({ connection }) {
    await connection.collection('books').createIndex({ title: 1 });
  },
};
```

Index DDL must not pass the migration transaction session to `createIndex`.
MongoDB rejects creating new indexes on existing collections inside a
multi-document transaction. The runner still records successful migrations in
`migration_records` after the migration body completes.

## Rollback Notes

Every migration must include `rollbackNotes`. Rollbacks are intentionally documented with each migration so reviewers can verify the operational plan before deployment. If a change cannot be safely rolled back, state that explicitly and describe the compensating action.
