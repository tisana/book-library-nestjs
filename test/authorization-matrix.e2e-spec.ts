import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  RequestMethod,
  Type,
  UnauthorizedException,
} from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { MemberAuthGuard } from '../src/auth/member-auth.guard';
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
import { MembershipTypesController } from '../src/membership-types/membership-types.controller';
import { MembershipTypesService } from '../src/membership-types/membership-types.service';
import { StaffUsersController } from '../src/staff-users/staff-users.controller';
import { StaffUsersService } from '../src/staff-users/staff-users.service';

type MatrixMethod = 'get' | 'patch' | 'post';

interface ProtectedAction {
  method: MatrixMethod;
  path: string;
  routePath?: string;
  requiredPermission: AuthPermission;
  allowToken: string;
  policyDenyToken: string;
  areaDenyToken: string;
  successStatus: number;
}

const staffReadToken = 'staff-all-permissions-token';
const staffPolicyDenyToken = 'staff-without-permissions-token';
const memberToken = 'member-token';
const memberPolicyDenyToken = 'member-without-self-read-token';
const staffInMemberAreaToken = 'staff-with-member-self-read-token';
const adminToken = 'admin-token';

const staffAction = (
  method: MatrixMethod,
  path: string,
  requiredPermission: AuthPermission,
  routePath = path,
  successStatus = method === 'post' ? 201 : 200,
): ProtectedAction => ({
  method,
  path,
  routePath,
  requiredPermission,
  allowToken: staffReadToken,
  policyDenyToken: staffPolicyDenyToken,
  areaDenyToken: memberToken,
  successStatus,
});

const memberAction = (path: string, routePath = path): ProtectedAction => ({
  method: 'get',
  path,
  routePath,
  requiredPermission: AuthPermission.MemberSelfRead,
  allowToken: memberToken,
  policyDenyToken: memberPolicyDenyToken,
  areaDenyToken: staffInMemberAreaToken,
  successStatus: 200,
});

const protectedActions: ProtectedAction[] = [
  staffAction('get', '/books', AuthPermission.CatalogRead),
  staffAction(
    'get',
    '/books/book-id',
    AuthPermission.CatalogRead,
    '/books/:id',
  ),
  staffAction('post', '/books', AuthPermission.CatalogManage),
  staffAction(
    'patch',
    '/books/book-id',
    AuthPermission.CatalogManage,
    '/books/:id',
  ),
  staffAction('get', '/book-categories', AuthPermission.CatalogRead),
  staffAction('post', '/book-categories', AuthPermission.CatalogManage),
  staffAction(
    'patch',
    '/book-categories/category-id',
    AuthPermission.CatalogManage,
    '/book-categories/:id',
  ),
  staffAction(
    'get',
    '/membership-types',
    AuthPermission.MembershipTypesRead,
  ),
  staffAction(
    'post',
    '/membership-types',
    AuthPermission.MembershipTypesManage,
  ),
  staffAction(
    'patch',
    '/membership-types/membership-type-id',
    AuthPermission.MembershipTypesManage,
    '/membership-types/:id',
  ),
  staffAction('get', '/members', AuthPermission.MembersRead),
  staffAction('post', '/members', AuthPermission.MembersManage),
  memberAction('/members/me'),
  memberAction('/members/me/policy-status'),
  memberAction('/members/me/borrowings'),
  memberAction(
    '/members/me/borrowings/borrowing-id',
    '/members/me/borrowings/:borrowingId',
  ),
  staffAction(
    'get',
    '/members/member-id/policy-status',
    AuthPermission.MembersRead,
    '/members/:id/policy-status',
  ),
  staffAction(
    'get',
    '/members/member-id/borrowings',
    AuthPermission.MembersRead,
    '/members/:id/borrowings',
  ),
  staffAction(
    'get',
    '/members/member-id',
    AuthPermission.MembersRead,
    '/members/:id',
  ),
  staffAction(
    'patch',
    '/members/member-id',
    AuthPermission.MembersManage,
    '/members/:id',
  ),
  staffAction('get', '/borrowings', AuthPermission.BorrowingsRead),
  staffAction('get', '/borrowings/overdue', AuthPermission.BorrowingsRead),
  staffAction(
    'get',
    '/borrowings/borrowing-id',
    AuthPermission.BorrowingsRead,
    '/borrowings/:id',
  ),
  staffAction('post', '/borrowings', AuthPermission.BorrowingsManage),
  staffAction(
    'post',
    '/borrowings/borrowing-id/return',
    AuthPermission.BorrowingsManage,
    '/borrowings/:id/return',
    200,
  ),
  {
    method: 'get',
    path: '/staff-users',
    requiredPermission: AuthPermission.StaffUsersRead,
    allowToken: adminToken,
    policyDenyToken: staffPolicyDenyToken,
    areaDenyToken: memberToken,
    successStatus: 200,
  },
  {
    method: 'post',
    path: '/staff-users',
    requiredPermission: AuthPermission.StaffUsersManage,
    allowToken: adminToken,
    policyDenyToken: staffPolicyDenyToken,
    areaDenyToken: memberToken,
    successStatus: 201,
  },
];

const protectedControllers: Type[] = [
  BooksController,
  BookCategoriesController,
  MembershipTypesController,
  MembersController,
  BorrowingsController,
  StaffUsersController,
];

function normalizeRoutePath(...segments: string[]): string {
  return `/${segments
    .flatMap((segment) => segment.split('/'))
    .filter(Boolean)
    .join('/')}`;
}

function controllerRouteInventory(controller: Type): string[] {
  const controllerPath = Reflect.getMetadata(PATH_METADATA, controller) as
    | string
    | undefined;

  return Object.getOwnPropertyNames(controller.prototype).flatMap(
    (methodName) => {
      if (methodName === 'constructor') return [];

      const handler = controller.prototype[methodName] as unknown;
      const routePath = Reflect.getMetadata(PATH_METADATA, handler as object) as
        | string
        | undefined;
      const requestMethod = Reflect.getMetadata(
        METHOD_METADATA,
        handler as object,
      ) as RequestMethod | undefined;

      if (routePath === undefined || requestMethod === undefined) return [];

      return [
        `${RequestMethod[requestMethod]} ${normalizeRoutePath(
          controllerPath ?? '',
          routePath,
        )}`,
      ];
    },
  );
}

describe('Protected controller authorization matrix (e2e)', () => {
  let app: INestApplication;

  const usersByToken = {
    [memberToken]: {
      id: 'member-id',
      memberNumber: 'M-1001',
      roleArea: 'member',
      roles: ['member'],
      permissions: [AuthPermission.MemberSelfRead],
    },
    [memberPolicyDenyToken]: {
      id: 'member-id',
      memberNumber: 'M-1001',
      roleArea: 'member',
      roles: ['member'],
      permissions: [],
    },
    [staffInMemberAreaToken]: {
      id: 'staff-id',
      roleArea: 'staff',
      roles: [StaffRole.Staff],
      permissions: [AuthPermission.MemberSelfRead],
    },
    [staffPolicyDenyToken]: {
      id: 'staff-id',
      roleArea: 'staff',
      roles: [StaffRole.Staff],
      permissions: [],
    },
    [staffReadToken]: {
      id: 'staff-id',
      roleArea: 'staff',
      roles: [StaffRole.Staff],
      permissions: Object.values(AuthPermission).filter(
        (permission) => permission !== AuthPermission.MemberSelfRead,
      ),
    },
    [adminToken]: {
      id: 'admin-id',
      roleArea: 'staff',
      roles: [StaffRole.Admin],
      permissions: Object.values(AuthPermission).filter(
        (permission) => permission !== AuthPermission.MemberSelfRead,
      ),
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

      if (!user) throw new UnauthorizedException();

      httpRequest.user = user;
      return true;
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: protectedControllers,
      providers: [
        MemberAuthGuard,
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
          provide: MembershipTypesService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'membership-type-id' }),
            findAll: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({ id: 'membership-type-id' }),
          },
        },
        {
          provide: MembersService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'member-id' }),
            findAll: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue({ id: 'member-id' }),
            findSelfServiceProfile: jest
              .fn()
              .mockResolvedValue({ id: 'member-id' }),
            getPolicyStatus: jest
              .fn()
              .mockResolvedValue({ memberId: 'member-id' }),
            update: jest.fn().mockResolvedValue({ id: 'member-id' }),
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
            findOneForMember: jest
              .fn()
              .mockImplementation((borrowingId: string) => {
                if (borrowingId === 'foreign-borrowing-id') {
                  throw new ForbiddenException('Borrowing is not owned by member');
                }
                return Promise.resolve({
                  id: borrowingId,
                  memberId: 'member-id',
                });
              }),
            findOverdue: jest.fn().mockResolvedValue([]),
            returnBorrowing: jest.fn().mockResolvedValue({
              id: 'borrowing-id',
              status: LoanState.Returned,
            }),
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

  afterAll(async () => {
    await app.close();
  });

  it('records every protected resource controller action exactly once', () => {
    const controllerInventory = protectedControllers
      .flatMap(controllerRouteInventory)
      .sort();
    const matrixInventory = protectedActions
      .map(
        ({ method, path, routePath }) =>
          `${method.toUpperCase()} ${routePath ?? path}`,
      )
      .sort();

    expect(matrixInventory).toEqual(controllerInventory);
    expect(new Set(matrixInventory).size).toBe(matrixInventory.length);
  });

  describe.each(protectedActions)(
    '$method $path [$requiredPermission]',
    (action) => {
      const call = (token?: string, path = action.path) => {
        const pending = request(app.getHttpServer())[action.method](path);
        if (token) pending.set('Authorization', `Bearer ${token}`);
        if (action.method !== 'get') pending.send({});
        return pending;
      };

      it('allows the authorized context', async () => {
        await call(action.allowToken).expect(action.successStatus);
      });

      it('denies a context missing the required policy', async () => {
        await call(action.policyDenyToken).expect(403);
      });

      it('denies the wrong member/staff role area', async () => {
        await call(action.areaDenyToken).expect(403);
      });

      it('denies an unauthenticated request', async () => {
        await call().expect(401);
      });
    },
  );

  it.each([
    [
      'member borrowing list with a user-supplied foreign member id',
      '/members/me/borrowings?memberId=another-member-id',
    ],
    [
      'member borrowing detail owned by another member',
      '/members/me/borrowings/foreign-borrowing-id',
    ],
  ])('denies horizontal ownership for %s', async (_label, path) => {
    await request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });
});
