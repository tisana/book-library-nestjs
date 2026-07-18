import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  HttpException,
  Inject,
  INestApplication,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model } from 'mongoose';
import * as request from 'supertest';

import { AuthController } from '../src/auth/auth.controller';
import { AuthBrowserOriginGuard } from '../src/auth/auth-browser-origin.guard';
import { AuthEndpointThrottleGuard } from '../src/auth/auth-endpoint-throttle.guard';
import {
  AuthSourceIdentityService,
  AuthSourceRequest,
} from '../src/auth/auth-source-identity.service';
import { AuthService } from '../src/auth/auth.service';
import {
  AuthThrottleDecision,
  AuthThrottleService,
  GenericSignInFailureCategory,
} from '../src/auth/auth-throttle.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';
import { PermissionsGuard } from '../src/auth/permissions.guard';
import { PermissionsService } from '../src/auth/permissions.service';
import { AuthIdentifierService } from '../src/auth/auth-identifier.service';
import {
  AuthThrottleBucketDocument,
  AuthThrottleBucketModelName,
  AuthThrottleBucketSchema,
} from '../src/auth/schemas/auth-throttle-bucket.schema';
import { AuthPermission } from '../src/common/enums/auth-permission.enum';
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

const trustedBrowserOrigin = 'http://localhost:5173';

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
        permissions: [
          AuthPermission.StaffUsersRead,
          AuthPermission.StaffUsersManage,
          AuthPermission.RolesRead,
          AuthPermission.RolesManage,
          AuthPermission.AuthIdentifiersRead,
          AuthPermission.AuthIdentifiersManage,
        ],
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
        PermissionsGuard,
        PermissionsService,
        {
          provide: AuthService,
          useValue: {
            createSharedSession: jest.fn(
              async ({ identifier }: { identifier: string }) => {
                if (identifier === 'ambiguous@example.test') {
                  throw new UnauthorizedException('Invalid credentials');
                }
                if (identifier === 'M-1001') {
                  return {
                    refreshToken: 'member-refresh',
                    refreshExpiresAt: new Date(Date.now() + 3_600_000),
                    response: {
                      accessToken: 'member-token',
                      tokenType: 'Bearer',
                      expiresIn: 900,
                      scope: 'member:self:read',
                      permissions: ['member:self:read'],
                      roleArea: 'member',
                      member: {
                        id: 'member-1',
                        memberNumber: 'M-1001',
                        displayName: 'Member One',
                      },
                    },
                  };
                }
                const isAdmin = identifier === adminTestUser.email;
                const fixture = isAdmin ? adminTestUser : staffTestUser;

                return {
                  refreshToken: isAdmin ? 'admin-refresh' : 'staff-refresh',
                  refreshExpiresAt: new Date(Date.now() + 3_600_000),
                  response: {
                    accessToken: isAdmin ? 'admin-token' : 'staff-token',
                    tokenType: 'Bearer',
                    expiresIn: 900,
                    scope: 'catalog:read',
                    permissions: ['catalog:read'],
                    roleArea: 'staff',
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
            update: jest.fn(),
          },
        },
        {
          provide: AuthIdentifierService,
          useValue: {
            listConflicts: jest.fn().mockResolvedValue([]),
            resolveConflict: jest.fn(),
            getOperationStatus: jest.fn(),
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
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtGuard)
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

  it('logs in an active staff user and returns a bearer token response', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', trustedBrowserOrigin)
      .send({
        identifier: staffTestUser.email,
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

  it('uses the shared endpoint for administrators and members', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', trustedBrowserOrigin)
      .send({
        identifier: adminTestUser.email,
        password: adminTestUser.password,
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          roleArea: 'staff',
          user: { roles: expect.arrayContaining([StaffRole.Admin]) },
        });
      });

    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', trustedBrowserOrigin)
      .send({ identifier: 'M-1001', password: 'MemberPass123!' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          roleArea: 'member',
          member: { memberNumber: 'M-1001' },
        });
      });
  });

  it('keeps compatibility wrappers aligned and denies ambiguity generically', async () => {
    await request(app.getHttpServer())
      .post('/auth/staff-login')
      .set('Origin', trustedBrowserOrigin)
      .send({ email: staffTestUser.email, password: staffTestUser.password })
      .expect(200)
      .expect(({ body }) => expect(body.roleArea).toBe('staff'));

    await request(app.getHttpServer())
      .post('/auth/member-login')
      .set('Origin', trustedBrowserOrigin)
      .send({ loginIdentifier: 'M-1001', password: 'MemberPass123!' })
      .expect(200)
      .expect(({ body }) => expect(body.roleArea).toBe('member'));

    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', trustedBrowserOrigin)
      .send({ identifier: 'ambiguous@example.test', password: 'password' })
      .expect(401)
      .expect(({ body }) => expect(body.message).toBe('Invalid credentials'));
  });

  it('refreshes the access token from the refresh cookie and rotates the cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', trustedBrowserOrigin)
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
      .set('Origin', trustedBrowserOrigin)
      .set('Cookie', ['book_library_refresh=staff-refresh'])
      .expect(200)
      .expect(({ headers }) => {
        expect(setCookieHeader(headers)).toContain('book_library_refresh=');
      });

    await request(app.getHttpServer())
      .post('/auth/logout-all')
      .set('Origin', trustedBrowserOrigin)
      .set('Authorization', 'Bearer staff-token')
      .expect(200);
  });

  it('rejects staff-users access without an admin role', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', trustedBrowserOrigin)
      .send({
        identifier: staffTestUser.email,
        password: staffTestUser.password,
      })
      .expect(200);

    await request(app.getHttpServer())
      .get('/staff-users')
      .set('Authorization', authHeader(loginResponse.body))
      .expect(403);
    await request(app.getHttpServer())
      .post('/staff-users')
      .set('Authorization', authHeader(loginResponse.body))
      .send({
        email: 'blocked@example.test',
        displayName: 'Blocked Staff',
        password: 'Temporary#2026',
        roles: ['staff'],
      })
      .expect(403);
    await request(app.getHttpServer())
      .patch('/staff-users/staff-user-id')
      .set('Authorization', authHeader(loginResponse.body))
      .send({ roles: ['admin'] })
      .expect(403);
    await request(app.getHttpServer())
      .get('/auth/roles')
      .set('Authorization', authHeader(loginResponse.body))
      .expect(403);
  });

  it('allows admin role access to staff-users management routes', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', trustedBrowserOrigin)
      .send({
        identifier: adminTestUser.email,
        password: adminTestUser.password,
      })
      .expect(200);

    await request(app.getHttpServer())
      .get('/staff-users')
      .set('Authorization', authHeader(loginResponse.body))
      .expect(200);

    const staffUsers = app.get(StaffUsersService) as jest.Mocked<StaffUsersService>;
    staffUsers.create.mockResolvedValue({
      id: 'created-staff-id',
      email: 'created@example.test',
      displayName: 'Created Staff',
      roles: [StaffRole.Staff],
      permissions: [AuthPermission.CatalogRead],
      status: 'active',
    } as never);
    staffUsers.update.mockResolvedValue({
      id: 'created-staff-id',
      email: 'created@example.test',
      displayName: 'Created Staff',
      roles: [StaffRole.Admin],
      permissions: [AuthPermission.StaffUsersManage],
      status: 'inactive',
    } as never);

    await request(app.getHttpServer())
      .post('/staff-users')
      .set('Authorization', authHeader(loginResponse.body))
      .send({
        email: 'created@example.test',
        displayName: 'Created Staff',
        password: 'Temporary#2026',
        roles: ['staff'],
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).not.toHaveProperty('password');
        expect(body).not.toHaveProperty('passwordHash');
      });
    await request(app.getHttpServer())
      .patch('/staff-users/created-staff-id')
      .set('Authorization', authHeader(loginResponse.body))
      .send({ roles: ['admin'], status: 'inactive' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ roles: ['admin'], status: 'inactive' });
      });
    await request(app.getHttpServer())
      .get('/auth/roles')
      .set('Authorization', authHeader(loginResponse.body))
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              role: 'admin',
              permissions: expect.arrayContaining(['staff-users:manage']),
            }),
          ]),
        );
      });
    expect(staffUsers.create).toHaveBeenCalledWith(
      expect.objectContaining({ roles: ['staff'] }),
      expect.objectContaining({ id: 'admin-user-id' }),
    );
    expect(staffUsers.update).toHaveBeenCalledWith(
      'created-staff-id',
      expect.objectContaining({ roles: ['admin'], status: 'inactive' }),
      expect.objectContaining({ id: 'admin-user-id' }),
    );
  });
});

const throttleHarnessService = Symbol('throttle-harness-service');
const throttleHarnessSource = Symbol('throttle-harness-source');

@Controller('_test/auth-throttle')
class AuthThrottleHarnessController {
  constructor(
    @Inject(throttleHarnessService)
    private readonly throttle: AuthThrottleService,
    @Inject(throttleHarnessSource)
    private readonly source: AuthSourceIdentityService,
  ) {}

  @Post('login/:entryPoint')
  async signIn(
    @Req() req: AuthSourceRequest,
    @Body()
    body: {
      normalizedIdentifier?: string;
      failureCategory?: GenericSignInFailureCategory;
    },
  ): Promise<AuthThrottleDecision> {
    return this.respond(
      await this.throttle.consumeSignInAttempt({
        sourceIdentity: this.source.resolve(req),
        normalizedIdentifier: body?.normalizedIdentifier,
        failureCategory: body?.failureCategory,
      }),
    );
  }

  @Post('refresh')
  async refresh(
    @Req() req: AuthSourceRequest,
    @Body() body: { familyId?: string },
  ): Promise<AuthThrottleDecision> {
    return this.respond(
      await this.throttle.consumeRefreshAttempt({
        sourceIdentity: this.source.resolve(req),
        familyId: body?.familyId,
      }),
    );
  }

  private respond(decision: AuthThrottleDecision): AuthThrottleDecision {
    if (!decision.allowed) {
      throw new HttpException(
        { statusCode: 429, message: 'Authentication temporarily unavailable' },
        429,
      );
    }

    return decision;
  }
}

class MutableThrottleConfig {
  readonly auth = {
    auditCorrelationKeyVersion: 1,
    auditCorrelationSecret: Buffer.alloc(32, 1).toString('base64url'),
    auditCorrelationPreviousKeys: {} as Record<string, string>,
    signInIdentifierFailureLimit: 5,
    signInSourceLimit: 20,
    signInWindowSeconds: 900,
    refreshThrottleLimit: 30,
    refreshThrottleWindowSeconds: 300,
    trustedProxyCidrs: [] as string[],
  };

  get(path: string): unknown {
    return path.split('.').reduce<unknown>(
      (value, key) => {
        if (!value || typeof value !== 'object') {
          return undefined;
        }

        return (value as Record<string, unknown>)[key];
      },
      { auth: this.auth },
    );
  }
}

describe('Authentication throttling persistence (e2e)', () => {
  let mongoServer: MongoMemoryServer;
  let connection: Connection;
  let bucketModel: Model<AuthThrottleBucketDocument>;
  let config: MutableThrottleConfig;
  let firstService: AuthThrottleService;
  let secondService: AuthThrottleService;
  let firstApp: INestApplication;
  let secondApp: INestApplication;

  async function createHarness(
    throttle: AuthThrottleService,
  ): Promise<INestApplication> {
    const module = await Test.createTestingModule({
      controllers: [AuthThrottleHarnessController],
      providers: [
        { provide: throttleHarnessService, useValue: throttle },
        {
          provide: throttleHarnessSource,
          useValue: new AuthSourceIdentityService(
            config as unknown as ConfigService,
          ),
        },
      ],
    }).compile();
    const app = module.createNestApplication();
    await app.init();
    return app;
  }

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    connection = mongoose.createConnection(mongoServer.getUri());
    await connection.asPromise();
    bucketModel = connection.model<AuthThrottleBucketDocument>(
      AuthThrottleBucketModelName,
      AuthThrottleBucketSchema,
    );
    await bucketModel.createIndexes();
  });

  beforeEach(async () => {
    await bucketModel.deleteMany({});
    config = new MutableThrottleConfig();
    firstService = new AuthThrottleService(
      bucketModel,
      config as unknown as ConfigService,
    );
    secondService = new AuthThrottleService(
      bucketModel,
      config as unknown as ConfigService,
    );
    firstApp = await createHarness(firstService);
    secondApp = await createHarness(secondService);
  });

  afterEach(async () => {
    await Promise.all([firstApp.close(), secondApp.close()]);
  });

  afterAll(async () => {
    await connection.close();
    await mongoServer.stop();
  });

  it('shares the sixth identifier failure across shared and compatibility routes', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const app = attempt % 2 ? firstApp : secondApp;
      const entryPoint = attempt % 2 ? 'shared' : 'compatibility';
      await request(app.getHttpServer())
        .post(`/_test/auth-throttle/login/${entryPoint}`)
        .send({
          normalizedIdentifier: 'reader@example.com',
          failureCategory: 'invalid-password',
        })
        .expect(201);
    }

    const response = await request(firstApp.getHttpServer())
      .post('/_test/auth-throttle/login/shared')
      .send({
        normalizedIdentifier: 'reader@example.com',
        failureCategory: 'unknown',
      })
      .expect(429);

    expect(response.body).toEqual({
      statusCode: 429,
      message: 'Authentication temporarily unavailable',
    });
  });

  it('atomically shares source and refresh boundaries across application instances', async () => {
    const signInResponses = await Promise.all(
      Array.from({ length: 21 }, (_, index) =>
        request((index % 2 ? firstApp : secondApp).getHttpServer())
          .post('/_test/auth-throttle/login/shared')
          .send(),
      ),
    );
    expect(signInResponses.filter(({ status }) => status === 429)).toHaveLength(
      1,
    );

    await bucketModel.deleteMany({});
    const refreshResponses: request.Response[] = [];
    for (let index = 0; index < 31; index += 1) {
      refreshResponses.push(
        await request((index % 2 ? firstApp : secondApp).getHttpServer())
          .post('/_test/auth-throttle/refresh')
          .send({ familyId: 'private-family-id' }),
      );
    }
    expect(
      refreshResponses.filter(({ status }) => status === 429),
    ).toHaveLength(1);
  });

  it('counts an unresolved refresh cookie by source without a family bucket', async () => {
    await request(firstApp.getHttpServer())
      .post('/_test/auth-throttle/refresh')
      .send({})
      .expect(201);

    const documents = await bucketModel.find().lean().exec();
    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      dimension: 'refresh-source',
      count: 1,
    });
  });

  it('preserves active windows through key rotation and fails closed without writes', async () => {
    const now = new Date('2026-07-15T00:00:00.000Z');
    await firstService.consumeSignInIdentifierFailure(
      'private.reader@example.com',
      'invalid-password',
      now,
    );
    config.auth.auditCorrelationKeyVersion = 2;
    config.auth.auditCorrelationSecret = Buffer.alloc(32, 2).toString(
      'base64url',
    );
    config.auth.auditCorrelationPreviousKeys = {
      1: Buffer.alloc(32, 1).toString('base64url'),
    };
    await secondService.consumeSignInIdentifierFailure(
      'private.reader@example.com',
      'invalid-password',
      now,
    );

    const before = await bucketModel.find().lean().exec();
    expect(before).toHaveLength(1);
    expect(before[0]).toMatchObject({ keyVersion: 1, count: 2 });

    config.auth.auditCorrelationPreviousKeys = {};
    await expect(
      firstService.consumeSignInIdentifierFailure(
        'private.reader@example.com',
        'invalid-password',
        now,
      ),
    ).resolves.toEqual({
      allowed: false,
      reason: 'throttle-key-required',
    });
    const after = await bucketModel.find().lean().exec();
    expect(after).toEqual(before);
  });

  it('recovers expired windows and persists only HMAC correlation values', async () => {
    const startedAt = new Date('2026-07-15T00:00:00.000Z');
    const source = '203.0.113.91';
    const identifier = 'private.reader@example.com';
    const familyId = 'private-family-id';
    await firstService.consumeSignInAttempt(
      {
        sourceIdentity: source,
        normalizedIdentifier: identifier,
        failureCategory: 'missing-credential',
      },
      startedAt,
    );
    await firstService.consumeRefreshAttempt(
      { sourceIdentity: source, familyId },
      startedAt,
    );
    await firstService.consumeSignInAttempt(
      { sourceIdentity: source },
      new Date(startedAt.getTime() + 900_001),
    );
    await firstService.consumeRefreshAttempt(
      { sourceIdentity: source, familyId },
      new Date(startedAt.getTime() + 300_001),
    );

    const documents = await bucketModel.find().lean().exec();
    expect(
      documents.find(({ dimension }) => dimension === 'sign-in-source')?.count,
    ).toBe(1);
    expect(
      documents.find(({ dimension }) => dimension === 'refresh-family')?.count,
    ).toBe(1);
    const persisted = JSON.stringify(documents);
    for (const rawValue of [source, identifier, familyId, 'private-token']) {
      expect(persisted).not.toContain(rawValue);
    }
  });
});
