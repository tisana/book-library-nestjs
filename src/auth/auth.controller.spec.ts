import { UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';

import { AuthPermission } from '../common/enums/auth-permission.enum';
import { StaffRole } from '../common/enums/library-status.enum';
import { deferred } from '../../test/support/backend-coverage-fixtures';
import { AuthController } from './auth.controller';
import { refreshCookieName } from './auth.service';

describe('AuthController shared authentication adapters', () => {
  const refreshExpiresAt = new Date('2026-08-15T12:00:00.000Z');
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'strict' as const,
    path: '/auth',
    expires: refreshExpiresAt,
  };
  const clearCookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'strict' as const,
    path: '/auth',
  };
  const staffResponse = {
    tokenType: 'Bearer' as const,
    expiresIn: 900,
    scope: AuthPermission.CatalogRead,
    permissions: [AuthPermission.CatalogRead],
    roleArea: 'staff' as const,
    user: {
      id: 'staff-1',
      email: 'admin@example.test',
      displayName: 'Admin One',
      roles: [StaffRole.Admin],
      permissions: [AuthPermission.CatalogRead],
    },
  };
  const memberResponse = {
    tokenType: 'Bearer' as const,
    expiresIn: 900,
    scope: AuthPermission.MemberSelfRead,
    permissions: [AuthPermission.MemberSelfRead],
    roleArea: 'member' as const,
    member: {
      id: 'member-1',
      memberNumber: 'M-1001',
      displayName: 'Member One',
      email: 'member@example.test',
      membershipStatus: 'active',
      membershipTypeId: 'type-1',
      membershipTypeCode: 'STANDARD',
      membershipTypeName: 'Standard',
    },
  };

  function createController(options?: {
    sessionResponse?: typeof staffResponse | typeof memberResponse;
    securityActivityService?: { list: jest.Mock };
    identifierResolution?: Record<string, unknown>;
  }) {
    const response = {
      cookie: jest.fn(),
      status: jest.fn(),
    } as unknown as Response;
    const authService = {
      createSharedSession: jest.fn().mockResolvedValue({
        response: options?.sessionResponse ?? staffResponse,
        refreshToken: 'opaque-refresh-value',
        refreshExpiresAt,
      }),
      getRefreshCookieOptions: jest.fn().mockReturnValue(cookieOptions),
      getClearRefreshCookieOptions: jest.fn().mockReturnValue(
        clearCookieOptions,
      ),
      logoutAll: jest.fn().mockResolvedValue(undefined),
    };
    const authThrottleService = {
      consumeSignInIdentifierFailure: jest
        .fn()
        .mockResolvedValue({ allowed: true }),
    };
    const permissionsService = { reviewStaffRoles: jest.fn() };
    const authIdentifierService = {
      resolveConflict: jest.fn().mockResolvedValue(
        options?.identifierResolution ?? {
          httpStatus: 200,
          operationId: 'operation-1',
          status: 'completed',
          replayed: false,
          result: {
            outcome: 'success',
            reasonCategory: 'identifier-conflict-resolved',
            internalDetails: 'must-not-leak',
          },
        },
      ),
    };
    const controller = new AuthController(
      authService as never,
      authThrottleService as never,
      permissionsService as never,
      authIdentifierService as never,
      options?.securityActivityService as never,
    );

    return {
      controller,
      response,
      authService,
      authThrottleService,
      authIdentifierService,
    };
  }

  it.each([
    {
      endpoint: 'login' as const,
      dto: { identifier: ' ADMIN@EXAMPLE.TEST ', password: 'pw' },
      expectedIdentifier: ' ADMIN@EXAMPLE.TEST ',
      sessionResponse: staffResponse,
    },
    {
      endpoint: 'staffLogin' as const,
      dto: { email: 'admin@example.test', password: 'pw' },
      expectedIdentifier: 'admin@example.test',
      sessionResponse: staffResponse,
    },
    {
      endpoint: 'memberLogin' as const,
      dto: { loginIdentifier: 'M-1001', password: 'pw' },
      expectedIdentifier: 'M-1001',
      sessionResponse: memberResponse,
    },
  ])(
    'maps $endpoint to shared auth and sets the absolute-expiry named cookie',
    async ({ endpoint, dto, expectedIdentifier, sessionResponse }) => {
      const fixture = createController({ sessionResponse });

      const result = await fixture.controller[endpoint](
        {} as never,
        dto as never,
        fixture.response,
      );

      expect(result).toEqual(sessionResponse);
      expect(fixture.authService.createSharedSession).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: expectedIdentifier,
          password: expect.any(String),
        }),
      );
      expect(fixture.response.cookie).toHaveBeenCalledWith(
        refreshCookieName,
        expect.any(String),
        cookieOptions,
      );
      expect(fixture.authService.getRefreshCookieOptions).toHaveBeenCalledWith(
        refreshExpiresAt,
      );
    },
  );

  it('projects member and staff auth contexts without cross-area fields', () => {
    const { controller } = createController();

    expect(
      controller.me({
        roleArea: 'member',
        id: 'member-1',
        memberNumber: 'M-1001',
        permissions: [AuthPermission.MemberSelfRead],
        email: 'must-not-leak@example.test',
      }),
    ).toEqual({
      roleArea: 'member',
      member: { id: 'member-1', memberNumber: 'M-1001' },
      permissions: [AuthPermission.MemberSelfRead],
    });
    expect(
      controller.me({
        roleArea: 'staff',
        id: 'staff-1',
        email: 'admin@example.test',
        displayName: 'Admin One',
        roles: [StaffRole.Admin],
        permissions: [AuthPermission.SecurityEventsRead],
        memberNumber: 'must-not-leak',
      }),
    ).toEqual({
      roleArea: 'staff',
      user: {
        id: 'staff-1',
        email: 'admin@example.test',
        displayName: 'Admin One',
        roles: [StaffRole.Admin],
        permissions: [AuthPermission.SecurityEventsRead],
      },
    });
  });

  it('forwards the public security activity query result', async () => {
    const resultDeferred = deferred<{ items: unknown[]; total: number }>();
    const securityActivityService = {
      list: jest.fn().mockReturnValue(resultDeferred.promise),
    };
    const { controller } = createController({ securityActivityService });
    const query = { page: 2, limit: 25 };

    const result = controller.securityActivity(query);
    resultDeferred.resolve({ items: [], total: 0 });

    await expect(result).resolves.toEqual({ items: [], total: 0 });
    expect(securityActivityService.list).toHaveBeenCalledWith(query);
  });

  it('reports when security activity is unavailable', () => {
    const { controller } = createController();

    expect(() => controller.securityActivity({ page: 1, limit: 25 })).toThrow(
      'Security activity service is unavailable',
    );
  });

  it('returns only the public conflict outcome and applies its HTTP status', async () => {
    const fixture = createController();
    const dto = { operationId: 'operation-1', reassignments: [] };

    const result = await fixture.controller.resolveIdentifierConflict(
      'conflict-1',
      dto,
      { id: 'staff-1' },
      fixture.response,
    );

    expect(fixture.response.status).toHaveBeenCalledWith(200);
    expect(result).toEqual({
      operationId: 'operation-1',
      status: 'completed',
      replayed: false,
      outcome: 'success',
      reasonCategory: 'identifier-conflict-resolved',
    });
    expect(JSON.stringify(result)).not.toContain('internalDetails');
  });

  it('clears the named cookie without a service call when auth context is absent', async () => {
    const fixture = createController();

    await expect(
      fixture.controller.logoutAll({}, fixture.response),
    ).resolves.toEqual({ success: true });
    expect(fixture.authService.logoutAll).not.toHaveBeenCalled();
    expect(fixture.response.cookie).toHaveBeenCalledWith(
      refreshCookieName,
      '',
      { ...clearCookieOptions, maxAge: 0 },
    );
  });

  it('revokes all sessions for a present auth context before clearing the cookie', async () => {
    const fixture = createController();
    const authContext = {
      subjectId: 'staff-1',
      subjectType: 'staff' as const,
      roleArea: 'staff' as const,
      roles: [StaffRole.Admin],
      permissions: [AuthPermission.SecurityEventsRead],
      authVersion: 2,
    };

    await expect(
      fixture.controller.logoutAll(
        {
          id: 'staff-1',
          subjectId: 'staff-1',
          roleArea: 'staff',
          permissions: [AuthPermission.SecurityEventsRead],
          authVersion: 2,
          authContext,
        },
        fixture.response,
      ),
    ).resolves.toEqual({ success: true });
    expect(fixture.authService.logoutAll).toHaveBeenCalledWith(authContext);
    expect(fixture.response.cookie).toHaveBeenCalledWith(
      refreshCookieName,
      '',
      { ...clearCookieOptions, maxAge: 0 },
    );
  });

  it('preserves generic login failures while recording identifier throttle state', async () => {
    const fixture = createController();
    fixture.authService.createSharedSession.mockRejectedValue(
      new UnauthorizedException('Invalid credentials'),
    );

    await expect(
      fixture.controller.login(
        {
          authThrottle: {
            sourceIdentity: 'source-1',
            normalizedIdentifier: 'missing@example.test',
          },
        } as never,
        { identifier: 'missing@example.test', password: 'pw' },
        fixture.response,
      ),
    ).rejects.toEqual(new UnauthorizedException('Invalid credentials'));
    expect(
      fixture.authThrottleService.consumeSignInIdentifierFailure,
    ).toHaveBeenCalledWith('missing@example.test', 'invalid-password');
    expect(fixture.response.cookie).not.toHaveBeenCalled();
  });

  it('preserves generic compatibility-login failures without throttle identifier context', async () => {
    const fixture = createController();
    fixture.authService.createSharedSession.mockRejectedValue(
      new UnauthorizedException('Invalid credentials'),
    );

    await expect(
      fixture.controller.staffLogin(
        {} as never,
        { email: 'missing@example.test', password: 'pw' },
        fixture.response,
      ),
    ).rejects.toEqual(new UnauthorizedException('Invalid credentials'));
    expect(
      fixture.authThrottleService.consumeSignInIdentifierFailure,
    ).not.toHaveBeenCalled();
    expect(fixture.response.cookie).not.toHaveBeenCalled();
  });
});
