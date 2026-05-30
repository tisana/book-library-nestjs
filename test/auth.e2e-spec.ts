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

describe('Authentication and staff-users authorization (e2e)', () => {
  let app: INestApplication;
  const usersByToken = {
    'staff-token': {
      id: 'staff-user-id',
      email: staffTestUser.email,
      displayName: staffTestUser.displayName,
      roles: staffTestUser.roles,
    },
    'admin-token': {
      id: 'admin-user-id',
      email: adminTestUser.email,
      displayName: adminTestUser.displayName,
      roles: adminTestUser.roles,
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
            login: jest.fn(async ({ email }: { email: string }) => {
              const isAdmin = email === adminTestUser.email;
              const fixture = isAdmin ? adminTestUser : staffTestUser;

              return {
                accessToken: isAdmin ? 'admin-token' : 'staff-token',
                user: {
                  id: isAdmin ? 'admin-user-id' : 'staff-user-id',
                  email: fixture.email,
                  displayName: fixture.displayName,
                  roles: fixture.roles,
                },
              };
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
      user: {
        email: staffTestUser.email,
        roles: expect.arrayContaining([StaffRole.Staff]),
      },
    });
    expect(response.body.user).not.toHaveProperty('password');
    expect(response.body.user).not.toHaveProperty('passwordHash');
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
