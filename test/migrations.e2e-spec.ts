import {
  MigrationCollection,
  MigrationConnection,
  MigrationDefinition,
  MigrationRecord,
  MigrationSession,
  getMongoConnectionOptions,
  runPendingMigrations,
} from '../migrations/migrate';

class FakeMigrationCollection<T extends { version?: string }>
  implements MigrationCollection<T>
{
  private readonly records: T[] = [];
  readonly indexes: Array<Record<string, unknown>> = [];

  async createIndex(keys: Record<string, 1 | -1>, options?: Record<string, unknown>) {
    this.indexes.push({ keys, options });
  }

  find(): ReturnType<MigrationCollection<T>['find']> {
    return {
      sort: (sort: Record<string, 1 | -1>) => {
        void sort;

        return {
          toArray: async () =>
            [...this.records].sort((a, b) =>
              String(a.version).localeCompare(String(b.version)),
            ),
        };
      },
    };
  }

  async insertOne(document: T) {
    if (
      document.version &&
      this.records.some((record) => record.version === document.version)
    ) {
      throw new Error(`Duplicate migration version ${document.version}`);
    }

    this.records.push(document);
  }
}

class FakeMigrationSession implements MigrationSession {
  async withTransaction(callback: () => Promise<void>): Promise<void> {
    await callback();
  }

  async endSession(): Promise<void> {}
}

class FakeMigrationConnection implements MigrationConnection {
  readonly migrationRecords = new FakeMigrationCollection<MigrationRecord>();

  collection<T>(name: string): MigrationCollection<T> {
    if (name !== 'migration_records') {
      throw new Error(`Unexpected collection ${name}`);
    }

    return this.migrationRecords as unknown as MigrationCollection<T>;
  }

  async startSession(): Promise<MigrationSession> {
    return new FakeMigrationSession();
  }
}

describe('migration runner', () => {
  it('uses direct host connections so local Docker replica set hostnames do not break status checks', () => {
    expect(getMongoConnectionOptions()).toMatchObject({
      directConnection: true,
      serverSelectionTimeoutMS: 5000,
    });
  });

  it('applies each migration once and stores rollback metadata', async () => {
    const connection = new FakeMigrationConnection();
    const up = jest.fn().mockResolvedValue(undefined);
    const migrations: MigrationDefinition[] = [
      {
        version: '001',
        name: 'library-core',
        rollbackNotes: ['Drop created indexes if rollback is required.'],
        up,
      },
    ];

    await runPendingMigrations(connection, migrations);
    await runPendingMigrations(connection, migrations);

    expect(up).toHaveBeenCalledTimes(1);
    await expect(
      connection.migrationRecords.find().sort({ version: 1 }).toArray(),
    ).resolves.toMatchObject([
      {
        version: '001',
        name: 'library-core',
        rollbackNotes: ['Drop created indexes if rollback is required.'],
        appliedAt: expect.any(Date),
      },
    ]);
  });
});
