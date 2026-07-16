import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AuthBrowserOriginGuard } from '../src/auth/auth-browser-origin.guard';
import { AuthController } from '../src/auth/auth.controller';
import { AuthEndpointThrottleGuard } from '../src/auth/auth-endpoint-throttle.guard';
import { AuthService } from '../src/auth/auth.service';
import { AuthSourceIdentityService } from '../src/auth/auth-source-identity.service';
import { AuthThrottleService } from '../src/auth/auth-throttle.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { TokenSessionService } from '../src/auth/token-session.service';

const trustedOrigins = ['https://library.example', 'https://staff.example'];
const familyExpiry = new Date(Date.now() + 3_600_000);

class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest().user = {
      authContext: {
        subjectId: 'staff-1',
        roleArea: 'staff',
        roles: ['admin'],
        permissions: [],
        authVersion: 0,
      },
    };
    return true;
  }
}

describe('Browser session security boundary (e2e)', () => {
  let app: INestApplication;

  const authService = {
    createSharedSession: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    logoutAll: jest.fn(),
    getRefreshCookieOptions: jest.fn(() => ({
      httpOnly: true,
      secure: true,
      sameSite: 'strict' as const,
      path: '/auth' as const,
      maxAge: 3_600_000,
    })),
    getClearRefreshCookieOptions: jest.fn(() => ({
      httpOnly: true,
      secure: true,
      sameSite: 'strict' as const,
      path: '/auth' as const,
      maxAge: 0,
    })),
  };
  const throttleService = {
    consumeSignInAttempt: jest.fn(),
    consumeSignInIdentifierFailure: jest.fn(),
    consumeRefreshAttempt: jest.fn(),
  };
  const tokenSessionService = { resolveFamilyId: jest.fn() };
  const sourceIdentityService = { resolve: jest.fn(() => '203.0.113.10') };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthBrowserOriginGuard,
        AuthEndpointThrottleGuard,
        { provide: AuthService, useValue: authService },
        { provide: AuthThrottleService, useValue: throttleService },
        { provide: TokenSessionService, useValue: tokenSessionService },
        { provide: AuthSourceIdentityService, useValue: sourceIdentityService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((path: string) =>
              path === 'auth.trustedBrowserOrigins'
                ? trustedOrigins
                : undefined,
            ),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestJwtGuard)
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    throttleService.consumeSignInAttempt.mockResolvedValue({ allowed: true });
    throttleService.consumeSignInIdentifierFailure.mockResolvedValue({
      allowed: true,
    });
    throttleService.consumeRefreshAttempt.mockResolvedValue({ allowed: true });
    tokenSessionService.resolveFamilyId.mockResolvedValue('family-1');
    authService.createSharedSession.mockImplementation(
      ({ identifier }: { identifier: string }) =>
        Promise.resolve(
          identifier === 'M-1'
            ? {
                response: {
                  accessToken: 'member-access',
                  tokenType: 'Bearer',
                  expiresIn: 900,
                  scope: 'member:self:read',
                  permissions: ['member:self:read'],
                  roleArea: 'member',
                  member: { id: 'member-1', memberNumber: 'M-1' },
                },
                refreshToken: 'member-refresh',
                refreshExpiresAt: familyExpiry,
              }
            : {
                response: {
                  accessToken: 'staff-access',
                  tokenType: 'Bearer',
                  expiresIn: 900,
                  scope: '',
                  permissions: [],
                  roleArea: 'staff',
                  user: {
                    id: 'staff-1',
                    email: 'staff@example.com',
                    displayName: 'Staff',
                    roles: ['staff'],
                    permissions: [],
                  },
                },
                refreshToken: 'staff-refresh',
                refreshExpiresAt: familyExpiry,
              },
        ),
    );
    authService.refresh.mockResolvedValue({
      response: {
        accessToken: 'rotated-access',
        tokenType: 'Bearer',
        expiresIn: 900,
        scope: '',
        permissions: [],
        user: { id: 'staff-1' },
      },
      refreshToken: 'rotated-refresh',
      refreshExpiresAt: familyExpiry,
    });
    authService.logout.mockResolvedValue(undefined);
    authService.logoutAll.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(trustedOrigins)(
    'accepts configured origin %s for staff and member compatibility login',
    async (origin) => {
      const staff = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Origin', origin)
        .send({ identifier: 'staff@example.com', password: 'secret' })
        .expect(200);
      const member = await request(app.getHttpServer())
        .post('/auth/member-login')
        .set('Origin', origin)
        .send({ loginIdentifier: 'M-1', password: 'secret' })
        .expect(200);

      expect(staff.body.expiresIn).toBe(900);
      expect(member.body.expiresIn).toBe(900);
      expect(staff.headers['set-cookie'][0]).toEqual(
        expect.stringContaining('Path=/auth'),
      );
      expect(staff.headers['set-cookie'][0]).toEqual(
        expect.stringContaining('HttpOnly'),
      );
      expect(staff.headers['set-cookie'][0]).toEqual(
        expect.stringContaining('Secure'),
      );
      expect(staff.headers['set-cookie'][0]).toEqual(
        expect.stringContaining('SameSite=Strict'),
      );
    },
  );

  it.each([
    ['missing', undefined],
    ['opaque', 'null'],
    ['multiple', 'https://library.example, https://staff.example'],
    ['malformed', 'not-an-origin'],
    ['untrusted', 'https://attacker.example'],
  ])(
    'rejects %s origin before throttle or authentication effects',
    async (_label, origin) => {
      const call = request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: 'staff@example.com', password: 'secret' });

      if (origin) {
        call.set('Origin', origin);
      }

      const response = await call.expect(403);
      expect(response.body.message).toBe('Browser session request denied');
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(throttleService.consumeSignInAttempt).not.toHaveBeenCalled();
      expect(authService.createSharedSession).not.toHaveBeenCalled();
      expect(authService.logout).not.toHaveBeenCalled();
    },
  );

  it('rotates with remaining family expiry and clears the identical cookie scope', async () => {
    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', trustedOrigins[0])
      .set('Cookie', 'book_library_refresh=current-refresh')
      .expect(200);

    expect(tokenSessionService.resolveFamilyId).toHaveBeenCalledWith(
      'current-refresh',
    );
    expect(authService.getRefreshCookieOptions).toHaveBeenCalledWith(
      familyExpiry,
    );
    expect(refreshed.headers['set-cookie'][0]).toContain('SameSite=Strict');

    const loggedOut = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Origin', trustedOrigins[0])
      .set('Cookie', 'book_library_refresh=rotated-refresh')
      .expect(200);

    expect(authService.logout).toHaveBeenCalledWith('rotated-refresh');
    expect(loggedOut.headers['set-cookie'][0]).toContain('Path=/auth');
    expect(loggedOut.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(loggedOut.headers['set-cookie'][0]).toContain('Secure');
    expect(loggedOut.headers['set-cookie'][0]).toContain('SameSite=Strict');
  });

  it('applies the origin boundary before authenticated all-session logout', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout-all')
      .set('Origin', trustedOrigins[0])
      .set('Authorization', 'Bearer access-token')
      .expect(200);

    expect(authService.logoutAll).toHaveBeenCalledWith(
      expect.objectContaining({
        roleArea: 'staff',
        subjectId: 'staff-1',
      }),
    );
  });
});
