import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import mongoose from 'mongoose';

export interface MigrationSession {
  withTransaction(callback: () => Promise<void>): Promise<void>;
  endSession(): Promise<void>;
}

export interface MigrationCollection<T> {
  createIndex(
    keys: Record<string, 1 | -1>,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
  updateMany(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
  find(): {
    sort(sort: Record<string, 1 | -1>): {
      toArray(): Promise<T[]>;
    };
  };
  insertOne(document: T, options?: Record<string, unknown>): Promise<unknown>;
}

export interface MigrationConnection {
  collection<T>(name: string): MigrationCollection<T>;
  startSession(): Promise<MigrationSession>;
}

export interface MigrationContext {
  connection: MigrationConnection;
  session: MigrationSession;
}

export interface MigrationDefinition {
  version: string;
  name: string;
  rollbackNotes: string[];
  up(context: MigrationContext): Promise<void>;
}

export interface MigrationRecord {
  version: string;
  name: string;
  rollbackNotes: string[];
  appliedAt: Date;
}

export type MigrationCommand = 'up' | 'status';

const migrationsDirectory = resolve(__dirname, 'versions');
const collectionName = 'migration_records';

export async function loadMigrations(): Promise<MigrationDefinition[]> {
  if (!existsSync(migrationsDirectory)) {
    return [];
  }

  const files = (await readdir(migrationsDirectory))
    .filter((file) => /^\d+-.+\.(ts|js)$/.test(file))
    .sort();

  return files.map((file) => {
    const loaded = require(join(migrationsDirectory, file)) as {
      default?: MigrationDefinition;
      migration?: MigrationDefinition;
    };
    const migration = loaded.default ?? loaded.migration;

    if (!migration?.version || !migration.name || !migration.up) {
      throw new Error(`Migration ${file} must export a MigrationDefinition`);
    }

    return migration;
  });
}

export function getMongoUri(): string {
  return process.env.MONGODB_URI ?? 'mongodb://localhost:27017/bookstore';
}

export function getMongoConnectionOptions(): Parameters<
  typeof mongoose.connect
>[1] {
  return {
    directConnection: true,
    serverSelectionTimeoutMS: 5000,
  };
}

export function getCommand(): MigrationCommand {
  const command = process.argv[2] ?? 'status';

  if (command === 'up' || command === 'status') {
    return command;
  }

  throw new Error(
    `Unsupported migration command "${command}". Use "up" or "status".`,
  );
}

export async function getAppliedRecords(
  connection: MigrationConnection,
): Promise<Map<string, MigrationRecord>> {
  const collection = connection.collection<MigrationRecord>(collectionName);
  await collection.createIndex({ version: 1 }, { unique: true });
  const records = await collection.find().sort({ version: 1 }).toArray();

  return new Map(records.map((record) => [record.version, record]));
}

export async function printStatus(
  connection: MigrationConnection,
  migrations: MigrationDefinition[],
) {
  const applied = await getAppliedRecords(connection);

  if (migrations.length === 0) {
    console.log('No migration files found.');
    return;
  }

  for (const migration of migrations) {
    const record = applied.get(migration.version);
    const state = record
      ? `applied at ${record.appliedAt.toISOString()}`
      : 'pending';
    console.log(`${migration.version} ${migration.name}: ${state}`);
  }
}

export async function runPendingMigrations(
  connection: MigrationConnection,
  migrations: MigrationDefinition[],
) {
  const applied = await getAppliedRecords(connection);
  const pending = migrations.filter(
    (migration) => !applied.has(migration.version),
  );

  if (pending.length === 0) {
    console.log('No pending migrations.');
    return;
  }

  for (const migration of pending) {
    const session = await connection.startSession();

    try {
      await session.withTransaction(async () => {
        await migration.up({ connection, session });
        await connection.collection<MigrationRecord>(collectionName).insertOne(
          {
            version: migration.version,
            name: migration.name,
            rollbackNotes: migration.rollbackNotes,
            appliedAt: new Date(),
          },
          { session },
        );
      });

      console.log(`Applied ${migration.version} ${migration.name}`);
    } finally {
      await session.endSession();
    }
  }
}

async function main() {
  const command = getCommand();
  const connection = mongoose.connection as unknown as MigrationConnection;

  await mongoose.connect(getMongoUri(), getMongoConnectionOptions());

  try {
    const migrations = await loadMigrations();

    if (command === 'status') {
      await printStatus(connection, migrations);
      return;
    }

    await runPendingMigrations(connection, migrations);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
