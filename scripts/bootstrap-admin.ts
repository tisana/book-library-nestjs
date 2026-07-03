import * as bcrypt from 'bcryptjs';
import mongoose, { Connection } from 'mongoose';

export interface BootstrapAdminOptions {
  mongoUri: string;
  email: string;
  password: string;
  displayName?: string;
}

export interface BootstrapAdminResult {
  created: boolean;
  email?: string;
  reason?: 'active-admin-exists';
}

const minimumPasswordLength = 12;
const blockedPasswords = new Set([
  'AdminPass123!',
  'ChangeMe12345',
  'Password12345',
  'P@ssword12345',
]);

export function readBootstrapAdminOptions(
  env: NodeJS.ProcessEnv = process.env,
): BootstrapAdminOptions {
  const email = env.FIRST_ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.FIRST_ADMIN_PASSWORD;

  if (!email) {
    throw new Error('FIRST_ADMIN_EMAIL is required');
  }

  if (!password) {
    throw new Error('FIRST_ADMIN_PASSWORD is required');
  }

  if (password.length < minimumPasswordLength) {
    throw new Error(
      `FIRST_ADMIN_PASSWORD must be at least ${minimumPasswordLength} characters`,
    );
  }

  if (blockedPasswords.has(password)) {
    throw new Error('FIRST_ADMIN_PASSWORD must not use demo credentials');
  }

  return {
    mongoUri: env.MONGODB_URI ?? 'mongodb://localhost:27017/bookstore',
    email,
    password,
    displayName:
      env.FIRST_ADMIN_DISPLAY_NAME?.trim() || 'Library Administrator',
  };
}

export async function bootstrapFirstAdministrator(
  options: BootstrapAdminOptions,
  existingConnection?: Connection,
): Promise<BootstrapAdminResult> {
  const connection =
    existingConnection ??
    (await mongoose
      .createConnection(options.mongoUri, {
        directConnection: true,
        serverSelectionTimeoutMS: 5000,
      })
      .asPromise());

  try {
    const staffUsers = connection.collection('staffusers');

    await staffUsers.createIndex({ email: 1 }, { unique: true });
    await staffUsers.createIndex({ status: 1, roles: 1 });

    const activeAdminCount = await staffUsers.countDocuments({
      status: 'active',
      roles: 'admin',
    });

    if (activeAdminCount > 0) {
      return { created: false, reason: 'active-admin-exists' };
    }

    const now = new Date();
    const passwordHash = await bcrypt.hash(options.password, 12);

    await staffUsers.insertOne({
      email: options.email.toLowerCase(),
      displayName: options.displayName ?? 'Library Administrator',
      passwordHash,
      roles: ['admin'],
      status: 'active',
      authVersion: 0,
      passwordUpdatedAt: now,
      createdBy: 'bootstrap-admin',
      updatedBy: 'bootstrap-admin',
      createdAt: now,
      updatedAt: now,
    });

    return { created: true, email: options.email.toLowerCase() };
  } finally {
    if (!existingConnection) {
      await connection.close();
    }
  }
}

async function main(): Promise<void> {
  const result = await bootstrapFirstAdministrator(readBootstrapAdminOptions());

  if (result.created) {
    console.log(`Created first administrator ${result.email}`);
    return;
  }

  console.log(
    'Active administrator already exists; no bootstrap user created.',
  );
}

if (require.main === module) {
  main().catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
