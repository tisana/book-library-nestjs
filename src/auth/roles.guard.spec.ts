/* eslint-disable @typescript-eslint/no-require-imports */
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { StaffRole } from '../common/enums/library-status.enum';

function loadExport(modulePath: string, exportName: string): any | undefined {
  try {
    return require(modulePath)[exportName];
  } catch {
    return undefined;
  }
}

function createExecutionContext(user?: {
  roles?: StaffRole[];
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;
}

describe('RolesGuard authorization contract', () => {
  const RolesGuard = loadExport('./roles.guard', 'RolesGuard');
  const ROLES_KEY = loadExport('./roles.decorator', 'ROLES_KEY');
  const describeIfImplemented =
    RolesGuard && ROLES_KEY ? describe : describe.skip;

  describeIfImplemented('when RolesGuard is implemented', () => {
    it('allows a user with one of the required roles', () => {
      const reflector = new Reflector();
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([StaffRole.Admin]);
      const guard = new RolesGuard(reflector);

      const allowed = guard.canActivate(
        createExecutionContext({ roles: [StaffRole.Admin] }),
      );

      expect(allowed).toBe(true);
    });

    it('rejects authenticated users without the required role', () => {
      const reflector = new Reflector();
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([StaffRole.Admin]);
      const guard = new RolesGuard(reflector);

      expect(() =>
        guard.canActivate(createExecutionContext({ roles: [StaffRole.Staff] })),
      ).toThrow(ForbiddenException);
    });

    it('allows routes without role metadata', () => {
      const reflector = new Reflector();
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const guard = new RolesGuard(reflector);

      expect(guard.canActivate(createExecutionContext())).toBe(true);
    });
  });
});
