import mongoose, { Connection } from 'mongoose';

export interface MongoTestContext {
  uri: string;
  connection: Connection;
  disconnect: () => Promise<void>;
  clearDatabase: () => Promise<void>;
}

export async function createMongoTestContext(
  uri = process.env.MONGODB_URI,
): Promise<MongoTestContext> {
  if (!uri) {
    throw new Error('MONGODB_URI is required for MongoDB integration tests');
  }

  const connection = mongoose.createConnection(uri);
  await connection.asPromise();

  return {
    uri,
    connection,
    disconnect: async () => {
      await connection.close();
    },
    clearDatabase: async () => {
      const collections = await connection.db.collections();
      await Promise.all(
        collections.map((collection) => collection.deleteMany({})),
      );
    },
  };
}

export async function expectTransactionSupport(
  connection: Connection,
): Promise<void> {
  const session = await connection.startSession();

  try {
    session.startTransaction();
    await session.abortTransaction();
  } finally {
    await session.endSession();
  }
}
