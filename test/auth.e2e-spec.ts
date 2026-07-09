import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';
import { StaffRole } from '../src/common/enums/library-status.enum';
import { StaffUsersController } from '../src/staff-users/staff-users.controller';
import { StaffUsersService } from '../src/staff-users/staff-users.service';
import {
  adminTestUser,
  authHeader,
  staffTestUser,
} from './utils/auth-test-helpers';

function setCookieHeader(headers: request.Response['headers']): string {
  const value = headers['set-cookie'];
  return Array.isArray(value) ? value.join(';') : (value ?? '').toString();
}

describe('Authentication and staff-users authorization (e2e)', () => {
  let app: INestApplication;
  const usersByToken = {
    'staff-token': {
      id: 'staff-user-id',
      subjectId: 'staff-user-id',
      email: staffTestUser.email,
      displayName: staffTestUser.displayName,
      roles: staffTestUser.roles,
      roleArea: 'staff',
      authContext: {
        subjectId: 'staff-user-id',
        roleArea: 'staff',
        roles: staffTestUser.roles,
        permissions: [],
        authVersion: 0,
      },
    },
    'admin-token': {
      id: 'admin-user-id',
      subjectId: 'admin-user-id',
      email: adminTestUser.email,
      displayName: adminTestUser.displayName,
      roles: adminTestUser.roles,
      roleArea: 'staff',
      authContext: {
        subjectId: 'admin-user-id',
        roleArea: 'staff',
        roles: adminTestUser.roles,
        permissions: [],
        authVersion: 0,
      },
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
      controllers: [AuthController, StaffUsersController],
      providers: [
        RolesGuard,
        {
          provide: AuthService,
          useValue: {
            createStaffSession: jest.fn(
              async ({ email }: { email: string }) => {
                const isAdmin = email === adminTestUser.email;
                const fixture = isAdmin ? adminTestUser : staffTestUser;

                return {
                  refreshToken: isAdmin ? 'admin-refresh' : 'staff-refresh',
                  response: {
                    accessToken: isAdmin ? 'admin-token' : 'staff-token',
                    tokenType: 'Bearer',
                    expiresIn: 900,
                    scope: 'catalog:read',
                    permissions: ['catalog:read'],
                    user: {
                      id: isAdmin ? 'admin-user-id' : 'staff-user-id',
                      email: fixture.email,
                      displayName: fixture.displayName,
                      roles: fixture.roles,
                      permissions: ['catalog:read'],
                    },
                  },
                };
              },
            ),
            refresh: jest.fn(async () => ({
              refreshToken: 'rotated-refresh',
              response: {
                accessToken: 'staff-token',
                tokenType: 'Bearer',
                expiresIn: 900,
                scope: 'catalog:read',
                permissions: ['catalog:read'],
                user: {
                  id: 'staff-user-id',
                  email: staffTestUser.email,
                  displayName: staffTestUser.displayName,
                  roles: staffTestUser.roles,
                  permissions: ['catalog:read'],
                },
              },
            })),
            logout: jest.fn().mockResolvedValue(undefined),
            logoutAll: jest.fn().mockResolvedValue(undefined),
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
          provide: StaffUsersService,
          useValue: {
            findAll: jest.fn(async () => [
              {
                id: 'staff-user-id',
                email: staffTestUser.email,
                displayName: staffTestUser.displayName,
                roles: staffTestUser.roles,
              },
            ]),
            create: jest.fn(),
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

  it('logs in an active staff user and returns a bearer token response', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: staffTestUser.email,
        password: staffTestUser.password,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      accessToken: 'staff-token',
      tokenType: 'Bearer',
      user: {
        email: staffTestUser.email,
        roles: expect.arrayContaining([StaffRole.Staff]),
      },
    });
    expect(setCookieHeader(response.headers)).toContain(
      'book_library_refresh=staff-refresh',
    );
    expect(response.body.user).not.toHaveProperty('password');
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  it('refreshes the access token from the refresh cookie and rotates the cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', ['book_library_refresh=staff-refresh'])
      .expect(200);

    expect(response.body).toMatchObject({
      accessToken: 'staff-token',
      tokenType: 'Bearer',
    });
    expect(setCookieHeader(response.headers)).toContain(
      'book_library_refresh=rotated-refresh',
    );
  });

  it('clears refresh cookie on logout and logout-all', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', ['book_library_refresh=staff-refresh'])
      .expect(200)
      .expect(({ headers }) => {
        expect(setCookieHeader(headers)).toContain('book_library_refresh=');
      });

    await request(app.getHttpServer())
      .post('/auth/logout-all')
      .set('Authorization', 'Bearer staff-token')
      .expect(200);
  });

  it('rejects staff-users access without an admin role', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: staffTestUser.email,
        password: staffTestUser.password,
      })
      .expect(200);

    await request(app.getHttpServer())
      .get('/staff-users')
      .set('Authorization', authHeader(loginResponse.body))
      .expect(403);
  });

  it('allows admin role access to staff-users management routes', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: adminTestUser.email,
        password: adminTestUser.password,
      })
      .expect(200);

    await request(app.getHttpServer())
      .get('/staff-users')
      .set('Authorization', authHeader(loginResponse.body))
      .expect(200);
  });
});
