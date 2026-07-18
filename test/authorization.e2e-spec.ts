import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose, { Connection, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import {
  MigrationConnection,
  loadMigrations,
  runPendingMigrations,
} from '../migrations/migrate';

import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/permissions.guard';
import { PermissionsService } from '../src/auth/permissions.service';
import { RolesGuard } from '../src/auth/roles.guard';
import { BookCategoriesController } from '../src/book-categories/book-categories.controller';
import { BookCategoriesService } from '../src/book-categories/book-categories.service';
import { BooksController } from '../src/books/books.controller';
import { BooksService } from '../src/books/books.service';
import { BorrowingsController } from '../src/borrowings/borrowings.controller';
import { BorrowingsService } from '../src/borrowings/borrowings.service';
import { AuthPermission } from '../src/common/enums/auth-permission.enum';
import { LoanState, StaffRole } from '../src/common/enums/library-status.enum';
import { MembersController } from '../src/members/members.controller';
import { MembersService } from '../src/members/members.service';
import { StaffUsersController } from '../src/staff-users/staff-users.controller';
import { StaffUsersService } from '../src/staff-users/staff-users.service';

describe('Authorization boundaries (e2e)', () => {
  let app: INestApplication;

  const usersByToken = {
    'member-token': {
      id: 'member-id',
      roleArea: 'member',
      roles: ['member'],
      permissions: [AuthPermission.MemberSelfRead],
    },
    'staff-without-permissions-token': {
      id: 'staff-id',
      roleArea: 'staff',
      roles: [StaffRole.Staff],
      permissions: [],
    },
    'staff-token': {
      id: 'staff-id',
      roleArea: 'staff',
      roles: [StaffRole.Staff],
      permissions: [
        AuthPermission.CatalogRead,
        AuthPermission.CatalogManage,
        AuthPermission.MembersRead,
        AuthPermission.MembersManage,
        AuthPermission.BorrowingsRead,
        AuthPermission.BorrowingsManage,
      ],
    },
    'admin-token': {
      id: 'admin-id',
      roleArea: 'staff',
      roles: [StaffRole.Admin],
      permissions: [
        AuthPermission.CatalogRead,
        AuthPermission.CatalogManage,
        AuthPermission.MembersRead,
        AuthPermission.MembersManage,
        AuthPermission.BorrowingsRead,
        AuthPermission.BorrowingsManage,
        AuthPermission.StaffUsersRead,
        AuthPermission.StaffUsersManage,
        AuthPermission.RolesRead,
        AuthPermission.RolesManage,
      ],
    },
  };

  const jwtGuard: CanActivate = {
    canActivate: (context: ExecutionContext) => {
      const httpRequest = context.switchToHttp().getRequest<{
        headers: Record<string, string | undefined>;
        user?: unknown;
      }>();
      const token = httpRequest.headers.authorization?.replace('Bearer ', '');
      const user = token
        ? usersByToken[token as keyof typeof usersByToken]
        : undefined;

      if (!user) {
        throw new UnauthorizedException();
      }

      httpRequest.user = user;
      return true;
    },
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        BookCategoriesController,
        BooksController,
        BorrowingsController,
        MembersController,
        StaffUsersController,
      ],
      providers: [
        PermissionsGuard,
        PermissionsService,
        RolesGuard,
        {
          provide: BookCategoriesService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'category-id' }),
            findAll: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({ id: 'category-id' }),
          },
        },
        {
          provide: BooksService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'book-id' }),
            findAll: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue({ id: 'book-id' }),
            update: jest.fn().mockResolvedValue({ id: 'book-id' }),
          },
        },
        {
          provide: BorrowingsService,
          useValue: {
            create: jest.fn().mockResolvedValue({
              id: 'borrowing-id',
              memberId: 'member-id',
              bookId: 'book-id',
              status: LoanState.Active,
            }),
            findAll: jest.fn().mockResolvedValue([]),
            findByMember: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue({ id: 'borrowing-id' }),
            findOneForMember: jest.fn().mockResolvedValue({
              id: 'borrowing-id',
              memberId: 'member-id',
            }),
            findOverdue: jest.fn().mockResolvedValue([]),
            returnBorrowing: jest.fn().mockResolvedValue({
              id: 'borrowing-id',
              status: LoanState.Returned,
            }),
          },
        },
        {
          provide: MembersService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'member-id' }),
            findAll: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue({ id: 'member-id' }),
            findSelfServiceProfile: jest.fn().mockResolvedValue({
              id: 'member-id',
            }),
            getPolicyStatus: jest.fn().mockResolvedValue({
              memberId: 'member-id',
            }),
            update: jest.fn().mockResolvedValue({ id: 'member-id' }),
          },
        },
        {
          provide: StaffUsersService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'staff-user-id' }),
            findAll: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each([
    ['GET', '/books'],
    ['POST', '/books'],
    ['GET', '/book-categories'],
    ['POST', '/book-categories'],
    ['GET', '/members'],
    ['POST', '/members'],
    ['GET', '/members/member-id'],
    ['GET', '/members/member-id/borrowings'],
    ['GET', '/members/member-id/policy-status'],
    ['GET', '/borrowings'],
    ['POST', '/borrowings'],
    ['GET', '/borrowings/overdue'],
    ['GET', '/borrowings/borrowing-id'],
    ['POST', '/borrowings/borrowing-id/return'],
    ['GET', '/staff-users'],
    ['POST', '/staff-users'],
  ])('denies member tokens from %s %s', async (method, path) => {
    const call = request(app.getHttpServer())
      [method.toLowerCase() as 'get' | 'post'](path)
      .set('Authorization', 'Bearer member-token');

    await call.send({}).expect(403);
  });

  it('denies staff tokens missing explicit catalog, member, and borrowing permissions', async () => {
    await request(app.getHttpServer())
      .get('/books')
      .set('Authorization', 'Bearer staff-without-permissions-token')
      .expect(403);
    await request(app.getHttpServer())
      .get('/members')
      .set('Authorization', 'Bearer staff-without-permissions-token')
      .expect(403);
    await request(app.getHttpServer())
      .get('/borrowings')
      .set('Authorization', 'Bearer staff-without-permissions-token')
      .expect(403);
  });

  it('allows staff tokens with required catalog, member, and borrowing permissions', async () => {
    await request(app.getHttpServer())
      .get('/books')
      .set('Authorization', 'Bearer staff-token')
      .expect(200);
    await request(app.getHttpServer())
      .get('/members')
      .set('Authorization', 'Bearer staff-token')
      .expect(200);
    await request(app.getHttpServer())
      .get('/borrowings')
      .set('Authorization', 'Bearer staff-token')
      .expect(200);
  });

  it('keeps staff-user routes admin-only for direct API requests', async () => {
    await request(app.getHttpServer())
      .get('/staff-users')
      .set('Authorization', 'Bearer member-token')
      .expect(403);
    await request(app.getHttpServer())
      .get('/staff-users')
      .set('Authorization', 'Bearer staff-token')
      .expect(403);
    await request(app.getHttpServer())
      .get('/staff-users')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);
  });
});

describe('authorization change propagation (e2e)', () => {
  const origin = 'http://localhost:5173';
  let replicaSet: MongoMemoryReplSet;
  let app: INestApplication;
  let connection: Connection;
  let targetId: string;
  let previousMongoUri: string | undefined;
  let previousTrustedOrigins: string | undefined;

  beforeAll(async () => {
    previousMongoUri = process.env.MONGODB_URI;
    previousTrustedOrigins = process.env.AUTH_TRUSTED_BROWSER_ORIGINS;
    process.env.AUTH_TRUSTED_BROWSER_ORIGINS = JSON.stringify([origin]);
    replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = replicaSet.getUri('authorization-propagation');
    connection = mongoose.createConnection(process.env.MONGODB_URI);
    await connection.asPromise();
    targetId = await seedAuthorizationAccounts(connection);
    await runPendingMigrations(
      connection as unknown as MigrationConnection,
      await loadMigrations(),
    );
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await connection?.close();
    await replicaSet?.stop();
    restoreAuthorizationEnv('MONGODB_URI', previousMongoUri);
    restoreAuthorizationEnv(
      'AUTH_TRUSTED_BROWSER_ORIGINS',
      previousTrustedOrigins,
    );
  });

  it('applies role and authVersion changes on the next protected request within 60 seconds', async () => {
    const staffLogin = await sharedLogin('staff@example.test', 'StaffPass#2026');
    const adminLogin = await sharedLogin('admin@example.test', 'AdminPass#2026');

    await request(app.getHttpServer())
      .get('/books')
      .set('Authorization', `Bearer ${staffLogin.accessToken}`)
      .expect(200);

    const roleChangeStartedAt = Date.now();
    await request(app.getHttpServer())
      .patch(`/staff-users/${targetId}`)
      .set('Authorization', `Bearer ${adminLogin.accessToken}`)
      .send({ roles: ['admin'] })
      .expect(200);
    await request(app.getHttpServer())
      .get('/books')
      .set('Authorization', `Bearer ${staffLogin.accessToken}`)
      .expect(401);
    expect(Date.now() - roleChangeStartedAt).toBeLessThan(60_000);

    const promotedLogin = await sharedLogin(
      'staff@example.test',
      'StaffPass#2026',
    );
    await request(app.getHttpServer())
      .get('/staff-users')
      .set('Authorization', `Bearer ${promotedLogin.accessToken}`)
      .expect(200);

    const authVersionChangeStartedAt = Date.now();
    await connection
      .collection('staffusers')
      .updateOne({ _id: new Types.ObjectId(targetId) }, { $inc: { authVersion: 1 } });
    await request(app.getHttpServer())
      .get('/staff-users')
      .set('Authorization', `Bearer ${promotedLogin.accessToken}`)
      .expect(401);
    expect(Date.now() - authVersionChangeStartedAt).toBeLessThan(60_000);
  }, 90_000);

  async function sharedLogin(identifier: string, password: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', origin)
      .send({ identifier, password })
      .expect(200);
    return response.body as { accessToken: string };
  }
});

async function seedAuthorizationAccounts(connection: Connection): Promise<string> {
  const now = new Date();
  const adminId = new Types.ObjectId();
  const staffId = new Types.ObjectId();
  await connection.collection('staffusers').insertMany([
    {
      _id: adminId,
      email: 'admin@example.test',
      displayName: 'Library Admin',
      passwordHash: await bcrypt.hash('AdminPass#2026', 10),
      roles: ['admin'],
      status: 'active',
      authVersion: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: staffId,
      email: 'staff@example.test',
      displayName: 'Library Staff',
      passwordHash: await bcrypt.hash('StaffPass#2026', 10),
      roles: ['staff'],
      status: 'active',
      authVersion: 0,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  return staffId.toString();
}

function restoreAuthorizationEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
