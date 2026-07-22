import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

function createExecutionContext(): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let reflector: Reflector;
  let guard: JwtAuthGuard;
  let parentCanActivate: jest.SpyInstance;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
    parentCanActivate = jest.spyOn(
      Object.getPrototypeOf(JwtAuthGuard.prototype) as {
        canActivate: (context: ExecutionContext) => unknown;
      },
      'canActivate',
    );
  });

  afterEach(() => {
    parentCanActivate.mockRestore();
  });

  it('bypasses authentication only for explicit public metadata', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    parentCanActivate.mockImplementation(() => {
      throw new UnauthorizedException();
    });

    expect(guard.canActivate(createExecutionContext())).toBe(true);
    expect(parentCanActivate).not.toHaveBeenCalled();
  });

  it('delegates unmarked routes to the JWT strategy', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    parentCanActivate.mockImplementation(() => {
      throw new UnauthorizedException();
    });

    expect(() => guard.canActivate(createExecutionContext())).toThrow(
      UnauthorizedException,
    );
    expect(parentCanActivate).toHaveBeenCalledTimes(1);
  });
});
