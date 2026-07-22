import { describe, expect, it, beforeEach } from 'vitest';
import {
  requireMemberSession,
  requireStaffPermission,
  requireStaffSession,
} from './route-guards';
import { authSession } from './session';

function expectRedirect(callback: () => unknown, to: string) {
  try {
    callback();
  } catch (caught) {
    expect(caught).toBeInstanceOf(Response);
    expect(
      (caught as Response & { options?: { to?: string } }).options?.to,
    ).toBe(to);
    return;
  }

  throw new Error(`Expected redirect to ${to}`);
}

describe('route guards', () => {
  beforeEach(() => {
    authSession.clear('signed-out');
  });

  it('redirects unauthenticated users to the matching login page', () => {
    expectRedirect(() => requireStaffSession(), '/login');
    expectRedirect(() => requireMemberSession(), '/login');
  });

  it('denies member sessions from staff/admin routes', () => {
    authSession.setSession('member-token', {
      id: 'member-1',
      memberNumber: 'M-1001',
      displayName: 'Member One',
      roleArea: 'member',
      membershipStatus: 'active',
      permissions: ['member:self:read'],
    });

    expectRedirect(() => requireStaffSession(), '/unauthorized');
    expect(authSession.getSnapshot().accessToken).toBeUndefined();
  });

  it('denies staff sessions from member routes and staff without required admin permission', () => {
    authSession.setSession('staff-token', {
      id: 'staff-1',
      email: 'staff@example.com',
      displayName: 'Staff User',
      roles: ['staff'],
      roleArea: 'staff',
      permissions: ['catalog:read'],
    });

    expectRedirect(() => requireMemberSession(), '/unauthorized');

    authSession.setSession('staff-token', {
      id: 'staff-1',
      email: 'staff@example.com',
      displayName: 'Staff User',
      roles: ['staff'],
      roleArea: 'staff',
      permissions: ['catalog:read'],
    });

    expectRedirect(
      () => requireStaffPermission('staff-users:read'),
      '/unauthorized',
    );
  });

  it('allows sessions with the required role area and permission', () => {
    authSession.setSession('admin-token', {
      id: 'staff-1',
      email: 'admin@example.com',
      displayName: 'Admin User',
      roles: ['admin'],
      roleArea: 'staff',
      permissions: ['catalog:read', 'staff-users:read'],
    });

    expect(requireStaffPermission('staff-users:read').user?.roleArea).toBe(
      'staff',
    );
  });
});
