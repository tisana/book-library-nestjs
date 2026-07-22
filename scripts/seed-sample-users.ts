import * as bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

interface SampleStaffUser {
  email: string;
  displayName: string;
  password: string;
  roles: string[];
}

const sampleUsers: SampleStaffUser[] = [
  {
    email: 'admin@example.com',
    displayName: 'Sample Admin',
    password: 'AdminPass123!',
    roles: ['admin'],
  },
  {
    email: 'staff@example.com',
    displayName: 'Sample Staff',
    password: 'StaffPass123!',
    roles: ['staff'],
  },
];

function getMongoUri(): string {
  return process.env.MONGODB_URI ?? 'mongodb://localhost:27017/bookstore';
}

async function seedSampleUsers(): Promise<void> {
  await mongoose.connect(getMongoUri(), {
    directConnection: true,
    serverSelectionTimeoutMS: 5000,
  });

  try {
    const staffUsers = mongoose.connection.collection('staffusers');
    const now = new Date();

    await staffUsers.createIndex({ email: 1 }, { unique: true });
    await staffUsers.createIndex({ status: 1, roles: 1 });

    for (const user of sampleUsers) {
      const email = user.email.toLowerCase();
      const passwordHash = await bcrypt.hash(user.password, 12);

      await staffUsers.updateOne(
        { email },
        {
          $set: {
            email,
            displayName: user.displayName,
            passwordHash,
            roles: user.roles,
            status: 'active',
            authVersion: 0,
            passwordUpdatedAt: now,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true },
      );

      console.log(`Seeded ${user.roles.join(',')} user ${email}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

void seedSampleUsers().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
