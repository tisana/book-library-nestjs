import { ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthBrowserOriginGuard } from './auth-browser-origin.guard';

function contextFor(
  origin: string | string[] | undefined,
  path = '/auth/refresh',
) {
  const request = {
    method: 'POST',
    path,
    route: { path: path.replace('/auth', '') },
    headers: origin === undefined ? {} : { origin },
  };

  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AuthBrowserOriginGuard', () => {
  let guard: AuthBrowserOriginGuard;

  beforeEach(() => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'auth.trustedBrowserOrigins'
          ? ['https://library.example', 'http://localhost:5173']
          : undefined,
      ),
    } as unknown as ConfigService;

    guard = new AuthBrowserOriginGuard(config);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('accepts one exact configured canonical origin', () => {
    expect(guard.canActivate(contextFor('https://library.example'))).toBe(true);
  });

  it('compares the parsed canonical origin so case and default ports normalize', () => {
    expect(guard.canActivate(contextFor('HTTPS://LIBRARY.EXAMPLE:443/'))).toBe(
      true,
    );
  });

  it.each([
    [undefined, 'missing'],
    ['null', 'opaque'],
    [['https://library.example', 'https://evil.example'], 'multiple'],
    ['https://library.example, https://evil.example', 'multiple'],
    ['not an origin', 'malformed'],
    ['https://library.example/path', 'malformed'],
    ['https://evil.example', 'untrusted'],
  ])('generically rejects %p without exposing the reason', (origin, reason) => {
    expect(reason).toEqual(expect.any(String));
    expect(() => guard.canActivate(contextFor(origin as never))).toThrow(
      new ForbiddenException('Browser session request denied'),
    );
  });

  it('uses fixed route categories and carries suppressed warning counts forward', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-15T00:00:00Z'));
    const warning = jest.spyOn(Logger.prototype, 'warn');

    expect(() => guard.canActivate(contextFor(undefined))).toThrow();
    expect(() => guard.canActivate(contextFor(undefined))).toThrow();
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        route: 'refresh',
        reason: 'missing',
        suppressedCount: 0,
      }),
    );

    jest.advanceTimersByTime(60_000);
    expect(() => guard.canActivate(contextFor(undefined))).toThrow();
    expect(warning).toHaveBeenCalledTimes(2);
    expect(warning.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        route: 'refresh',
        reason: 'missing',
        suppressedCount: 1,
      }),
    );
    expect(JSON.stringify(warning.mock.calls)).not.toContain('evil.example');
    jest.useRealTimers();
  });

  it('does not invoke any persistence or downstream request behavior', () => {
    const context = contextFor('https://evil.example');
    const request = context.switchToHttp().getRequest();
    const cookieRead = jest.fn();
    Object.defineProperty(request, 'cookies', { get: cookieRead });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(cookieRead).not.toHaveBeenCalled();
  });
});
