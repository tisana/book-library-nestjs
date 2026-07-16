import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { AuthController } from '../src/auth/auth.controller';
import { AuthBrowserOriginGuard } from '../src/auth/auth-browser-origin.guard';
import { AuthEndpointThrottleGuard } from '../src/auth/auth-endpoint-throttle.guard';
import { AuthService } from '../src/auth/auth.service';
import { AuthThrottleService } from '../src/auth/auth-throttle.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { MemberAuthGuard } from '../src/auth/member-auth.guard';
import { PermissionsGuard } from '../src/auth/permissions.guard';
import { PermissionsService } from '../src/auth/permissions.service';
import { AuthPermission } from '../src/common/enums/auth-permission.enum';
import { StaffRole } from '../src/common/enums/library-status.enum';
import { BorrowingsService } from '../src/borrowings/borrowings.service';
import { MembersController } from '../src/members/members.controller';
import { MembersService } from '../src/members/members.service';

function setCookieHeader(headers: request.Response['headers']): string {
  const value = headers['set-cookie'];
  return Array.isArray(value) ? value.join(';') : (value ?? '').toString();
}

describe('Member self-service authorization (e2e)', () => {
  let app: INestApplication;
  const membersService = {
    findOne: jest.fn(),
    findSelfServiceProfile: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    getPolicyStatus: jest.fn(),
  };
  const borrowingsService = {
    findByMember: jest.fn(),
    findOneForMember: jest.fn(),
  };
  const usersByToken = {
    'member-token': {
      id: 'member-1',
      memberNumber: 'M-1001',
      roleArea: 'member',
      permissions: [AuthPermission.MemberSelfRead],
    },
    'staff-token': {
      id: 'staff-1',
      email: 'staff@example.test',
      displayName: 'Staff User',
      roles: [StaffRole.Staff],
      roleArea: 'staff',
      permissions: [],
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
    jest.clearAllMocks();
    membersService.findOne.mockResolvedValue({ id: 'member-1' });
    membersService.findSelfServiceProfile.mockResolvedValue({ id: 'member-1' });
    membersService.getPolicyStatus.mockResolvedValue({ memberId: 'member-1' });
    borrowingsService.findByMember.mockResolvedValue([
      { id: 'borrowing-1', memberId: 'member-1' },
    ]);
    borrowingsService.findOneForMember.mockResolvedValue({
      id: 'borrowing-1',
      memberId: 'member-1',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MembersController],
      providers: [
        MemberAuthGuard,
        PermissionsGuard,
        PermissionsService,
        { provide: MembersService, useValue: membersService },
        { provide: BorrowingsService, useValue: borrowingsService },
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

  it('derives /members/me from the authenticated member token', async () => {
    await request(app.getHttpServer())
      .get('/members/me')
      .set('Authorization', 'Bearer member-token')
      .expect(200);

    expect(membersService.findSelfServiceProfile).toHaveBeenCalledWith(
      'member-1',
    );
  });

  it('does not allow member tokens to access arbitrary staff member IDs', async () => {
    await request(app.getHttpServer())
      .get('/members/member-2')
      .set('Authorization', 'Bearer member-token')
      .expect(403);
  });

  it('does not allow staff tokens to access member self-service routes', async () => {
    await request(app.getHttpServer())
      .get('/members/me')
      .set('Authorization', 'Bearer staff-token')
      .expect(403);
  });
});

describe('Member authentication endpoints (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            createSharedSession: jest.fn(async () => ({
              refreshToken: 'member-refresh-token',
              refreshExpiresAt: new Date(Date.now() + 3_600_000),
              response: {
                accessToken: 'member-access-token',
                tokenType: 'Bearer',
                expiresIn: 900,
                scope: 'member:self:read',
                permissions: ['member:self:read'],
                roleArea: 'member',
                member: {
                  id: 'member-1',
                  memberNumber: 'M-1001',
                  displayName: 'Jane Reader',
                  email: 'jane.reader@example.test',
                },
              },
            })),
            refresh: jest.fn(async () => ({
              refreshToken: 'rotated-member-refresh-token',
              response: {
                accessToken: 'member-access-token-2',
                tokenType: 'Bearer',
                expiresIn: 900,
                scope: 'member:self:read',
                permissions: ['member:self:read'],
                member: {
                  id: 'member-1',
                  memberNumber: 'M-1001',
                  displayName: 'Jane Reader',
                  email: 'jane.reader@example.test',
                },
              },
            })),
            getRefreshCookieTtlSeconds: jest.fn().mockReturnValue(3600),
            getRefreshCookieOptions: jest.fn().mockReturnValue({
              httpOnly: true,
              secure: false,
              sameSite: 'lax',
              path: '/auth',
              maxAge: 3600000,
            }),
            getClearRefreshCookieOptions: jest.fn().mockReturnValue({
              httpOnly: true,
              secure: false,
              sameSite: 'lax',
              path: '/auth',
              maxAge: 0,
            }),
          },
        },
        {
          provide: AuthThrottleService,
          useValue: {
            consumeSignInIdentifierFailure: jest
              .fn()
              .mockResolvedValue({ allowed: true }),
          },
        },
      ],
    })
      .overrideGuard(AuthBrowserOriginGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AuthEndpointThrottleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('returns member token metadata and sets a refresh cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/member-login')
      .set('Origin', 'http://localhost:5173')
      .send({ loginIdentifier: 'M-1001', password: 'MemberPass123!' })
      .expect(200);

    expect(response.body).toMatchObject({
      accessToken: 'member-access-token',
      tokenType: 'Bearer',
      scope: 'member:self:read',
      permissions: ['member:self:read'],
      member: {
        id: 'member-1',
        memberNumber: 'M-1001',
      },
    });
    expect(setCookieHeader(response.headers)).toContain(
      'book_library_refresh=member-refresh-token',
    );
  });

  it('rotates member refresh cookies on refresh', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', ['book_library_refresh=member-refresh-token'])
      .expect(200);

    expect(response.body).toMatchObject({
      accessToken: 'member-access-token-2',
      tokenType: 'Bearer',
    });
    expect(setCookieHeader(response.headers)).toContain(
      'book_library_refresh=rotated-member-refresh-token',
    );
  });
});
