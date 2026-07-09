import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

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
