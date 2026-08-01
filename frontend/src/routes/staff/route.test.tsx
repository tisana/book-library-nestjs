import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type AnyRoute,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthPermission } from '@/lib/api/types';
import { apiBaseUrl } from '@/lib/api/client';
import { authSession } from '@/lib/auth/session';
import { requireStaffSession } from '@/lib/auth/route-guards';
import { server } from '@/test/mocks/server';
import { createStaffRoutes } from './route';

function createStaffTestRouter(initialPath = '/') {
  const rootRoute = createRootRoute({ component: Outlet });
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'login',
    component: () => <h1>Shared login target</h1>,
  });
  const routeTree = rootRoute.addChildren([
    loginRoute,
    createStaffRoutes(rootRoute),
  ]);
  const history = createMemoryHistory({ initialEntries: [initialPath] });

  return createRouter({ history, routeTree });
}

function seedStaffSession(permissions: AuthPermission[]) {
  authSession.setSession('staff-token', {
    id: 'staff-1',
    email: 'admin@example.com',
    displayName: 'Library Admin',
    roles: ['admin'],
    roleArea: 'staff',
    permissions,
  });
}

function runBeforeLoad(route: AnyRoute) {
  return (route.options.beforeLoad as () => unknown)();
}

function expectUnauthorized(callback: () => unknown) {
  try {
    callback();
  } catch (caught) {
    expect(caught).toBeInstanceOf(Response);
    expect(
      (caught as Response & { options?: { to?: string } }).options?.to,
    ).toBe('/unauthorized');
    return;
  }

  throw new Error('Expected an unauthorized redirect.');
}

describe('createStaffRoutes', () => {
  beforeAll(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    authSession.clear('signed-out');
  });

  it('builds the complete staff tree with the real session guard', () => {
    const testRouter = createStaffTestRouter();

    expect(testRouter.routesById['/staff'].options.beforeLoad).toBe(
      requireStaffSession,
    );
    expect(Object.keys(testRouter.routesByPath)).toEqual(
      expect.arrayContaining([
        '/staff',
        '/staff/login',
        '/staff/books',
        '/staff/books/$bookId',
        '/staff/catalog',
        '/staff/membership-types',
        '/staff/members',
        '/staff/members/$memberId',
        '/staff/borrowings',
        '/staff/borrowings/new',
        '/staff/borrowings/overdue',
        '/staff/borrowings/$borrowingId',
        '/staff/users',
        '/staff/identifier-conflicts',
        '/staff/security-activity',
      ]),
    );
  });

  it('retains both staff-user and role permissions on the staff access route', () => {
    const usersRoute = createStaffTestRouter().routesByPath[
      '/staff/users'
    ] as AnyRoute;

    seedStaffSession(['staff-users:read']);
    expectUnauthorized(() => runBeforeLoad(usersRoute));

    seedStaffSession(['roles:read']);
    expectUnauthorized(() => runBeforeLoad(usersRoute));

    seedStaffSession(['staff-users:read', 'roles:read']);
    expect(runBeforeLoad(usersRoute)).toMatchObject({
      permissions: ['staff-users:read', 'roles:read'],
      roleArea: 'staff',
    });
  });

  it.each([
    ['/staff/identifier-conflicts', 'auth-identifiers:read'],
    ['/staff/security-activity', 'security-events:read'],
  ] as const)('retains the %s permission guard', (path, permission) => {
    const guardedRoute = createStaffTestRouter().routesByPath[path] as AnyRoute;

    seedStaffSession(['catalog:read']);
    expectUnauthorized(() => runBeforeLoad(guardedRoute));

    seedStaffSession([permission]);
    expect(runBeforeLoad(guardedRoute)).toMatchObject({
      permissions: [permission],
      roleArea: 'staff',
    });
  });

  it('matches the compatibility login without rendering the staff shell', async () => {
    const testRouter = createStaffTestRouter('/staff/login');

    render(<RouterProvider router={testRouter} />);

    await waitFor(() =>
      expect(testRouter.history.location.pathname).toBe('/login'),
    );
    expect(
      screen.getByRole('heading', { name: 'Shared login target' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Library Admin')).not.toBeInTheDocument();
  });

  it('renders protected staff books inside the real shell outlet', async () => {
    seedStaffSession(['catalog:read']);
    server.use(
      http.get(`${apiBaseUrl}/books`, () => HttpResponse.json([])),
      http.get(`${apiBaseUrl}/book-categories`, () => HttpResponse.json([])),
    );
    const client = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    });
    const testRouter = createStaffTestRouter('/staff/books');

    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={testRouter} />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Book Collection' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Library Admin')).toBeInTheDocument();
    expect(await screen.findByText('No books yet')).toBeInTheDocument();
  });
});
