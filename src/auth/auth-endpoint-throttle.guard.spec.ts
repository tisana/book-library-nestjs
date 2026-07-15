import { ExecutionContext } from '@nestjs/common';
import { AuthEndpointThrottleGuard } from './auth-endpoint-throttle.guard';

function contextFor(request: Record<string, unknown>) {
  const response = { setHeader: jest.fn() };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;

  return { context, response };
}

describe('AuthEndpointThrottleGuard', () => {
  const sourceIdentityService = { resolve: jest.fn(() => '203.0.113.9') };
  const tokenSessionService = { resolveFamilyId: jest.fn() };
  const throttleService = {
    consumeSignInAttempt: jest.fn(),
    consumeRefreshAttempt: jest.fn(),
  };

  let guard: AuthEndpointThrottleGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    throttleService.consumeSignInAttempt.mockResolvedValue({ allowed: true });
    throttleService.consumeRefreshAttempt.mockResolvedValue({ allowed: true });
    tokenSessionService.resolveFamilyId.mockResolvedValue(undefined);
    guard = new AuthEndpointThrottleGuard(
      throttleService as never,
      sourceIdentityService as never,
      tokenSessionService as never,
    );
  });

  it('counts a valid login source before DTO handling and attaches safe context', async () => {
    const request = {
      path: '/auth/login',
      body: { email: ' Staff@Example.com ', password: 'secret' },
      headers: {},
      socket: { remoteAddress: '203.0.113.9' },
    };
    const { context } = contextFor(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(throttleService.consumeSignInAttempt).toHaveBeenCalledWith({
      sourceIdentity: '203.0.113.9',
      normalizedIdentifier: 'staff@example.com',
      failureCategory: undefined,
    });
    expect(request).toMatchObject({
      authThrottle: {
        sourceIdentity: '203.0.113.9',
        normalizedIdentifier: 'staff@example.com',
      },
    });
  });

  it('counts a normalizable missing-credential request against both boundaries', async () => {
    const { context } = contextFor({
      path: '/auth/member-login',
      body: { loginIdentifier: 'M-1001' },
      headers: {},
      socket: { remoteAddress: '203.0.113.9' },
    });

    await guard.canActivate(context);
    expect(throttleService.consumeSignInAttempt).toHaveBeenCalledWith({
      sourceIdentity: '203.0.113.9',
      normalizedIdentifier: 'm-1001',
      failureCategory: 'missing-credential',
    });
  });

  it('resolves a refresh family before consuming source and family boundaries', async () => {
    tokenSessionService.resolveFamilyId.mockResolvedValue('family-1');
    const { context } = contextFor({
      path: '/auth/refresh',
      body: {},
      headers: { cookie: 'book_library_refresh=refresh-token' },
      socket: { remoteAddress: '203.0.113.9' },
    });

    await guard.canActivate(context);
    expect(tokenSessionService.resolveFamilyId).toHaveBeenCalledWith(
      'refresh-token',
    );
    expect(throttleService.consumeRefreshAttempt).toHaveBeenCalledWith({
      sourceIdentity: '203.0.113.9',
      familyId: 'family-1',
    });
  });

  it('fails closed with one generic 429 and optional Retry-After', async () => {
    throttleService.consumeSignInAttempt.mockResolvedValue({
      allowed: false,
      reason: 'throttle-limit-exceeded',
      retryAfterSeconds: 30,
    });
    const { context, response } = contextFor({
      path: '/auth/login',
      body: { email: 'staff@example.com', password: 'wrong' },
      headers: {},
      socket: { remoteAddress: '203.0.113.9' },
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 429,
      response: {
        message: 'Authentication temporarily unavailable',
      },
    });
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '30');
  });
});
