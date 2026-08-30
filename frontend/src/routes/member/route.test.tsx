import {
  Outlet,
  createRootRoute,
  createRouter,
  type AnyRoute,
} from '@tanstack/react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { authSession } from '@/lib/auth/session';
import { requireMemberSession } from '@/lib/auth/route-guards';
import { createMemberRoutes } from './route';

function createMemberTestRouter() {
  const rootRoute = createRootRoute({ component: Outlet });
  const routeTree = rootRoute.addChildren([createMemberRoutes(rootRoute)]);
  return createRouter({ routeTree });
}

function runBeforeLoad(route: AnyRoute) {
  return (route.options.beforeLoad as () => unknown)();
}

function expectLoginRedirect(callback: () => unknown) {
  try {
    callback();
  } catch (caught) {
    expect(caught).toBeInstanceOf(Response);
    expect(
      (caught as Response & { options?: { to?: string } }).options?.to,
    ).toBe('/login');
    return;
  }

  throw new Error('Expected a shared-login redirect.');
}

describe('createMemberRoutes', () => {
  beforeEach(() => {
    authSession.clear('signed-out');
  });

  it('builds the private member tree with its borrowing detail child', () => {
    const testRouter = createMemberTestRouter();

    expect(testRouter.routesById['/member'].options.beforeLoad).toBe(
      requireMemberSession,
    );
    expect(Object.keys(testRouter.routesByPath)).toEqual(
      expect.arrayContaining([
        '/member',
        '/member/borrowings',
        '/member/borrowings/$borrowingId',
      ]),
    );
    expect(
      testRouter.routesByPath['/member/borrowings/$borrowingId'].parentRoute
        .fullPath,
    ).toBe('/member');
  });

  it('wires the member root to the real member session guard', () => {
    const memberRoute = createMemberTestRouter().routesById[
      '/member'
    ] as AnyRoute;

    expectLoginRedirect(() => runBeforeLoad(memberRoute));

    authSession.setSession('member-token', {
      id: 'member-1',
      memberNumber: 'M-1001',
      displayName: 'Member One',
      membershipStatus: 'active',
      roleArea: 'member',
      permissions: ['member:self:read'],
    });
    expect(runBeforeLoad(memberRoute)).toMatchObject({
      permissions: ['member:self:read'],
      roleArea: 'member',
    });
  });
});
