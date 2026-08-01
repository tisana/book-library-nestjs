import { describe, expect, it } from 'vitest';
import { queryClient } from './query-client';
import { router } from './router';
import {
  LoginRoute,
  MemberLoginPlaceholderRoute,
  PublicHome,
  StaffLoginRoute,
  UnauthorizedRoute,
} from '@/routes/public';
import {
  requireMemberSession,
  requireStaffSession,
} from '@/lib/auth/route-guards';

describe('application router', () => {
  it('registers one shared login and compatibility redirects in the real route tree', () => {
    expect(router.routesByPath['/'].options.component).toBe(PublicHome);
    expect(router.routesByPath['/login'].options.component).toBe(LoginRoute);
    expect(router.routesByPath['/member/login'].options.component).toBe(
      MemberLoginPlaceholderRoute,
    );
    expect(router.routesByPath['/staff/login'].options.component).toBe(
      StaffLoginRoute,
    );
    expect(router.routesByPath['/unauthorized'].options.component).toBe(
      UnauthorizedRoute,
    );
  });

  it('retains the real authorization boundaries and application query context', () => {
    expect(router.routesById['/staff'].options.beforeLoad).toBe(
      requireStaffSession,
    );
    expect(router.routesById['/member'].options.beforeLoad).toBe(
      requireMemberSession,
    );
    expect(router.routesByPath['/staff/users'].options.beforeLoad).toEqual(
      expect.any(Function),
    );
    expect(
      router.routesByPath['/staff/identifier-conflicts'].options.beforeLoad,
    ).toEqual(expect.any(Function));
    expect(
      router.routesByPath['/staff/security-activity'].options.beforeLoad,
    ).toEqual(expect.any(Function));
    expect(router.options.context.queryClient).toBe(queryClient);
  });
});
