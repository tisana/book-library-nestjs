import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { queryClient } from './query-client';
import {
  LoginRoute,
  MemberLoginPlaceholderRoute,
  PublicHome,
  UnauthorizedRoute,
} from '@/routes/public';
import { createMemberRoutes } from '@/routes/member/route';
import { createStaffRoutes } from '@/routes/staff/route';

interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: PublicHome,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'login',
  component: LoginRoute,
});

const memberLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/member/login',
  component: MemberLoginPlaceholderRoute,
});

const unauthorizedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'unauthorized',
  component: UnauthorizedRoute,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  memberLoginRoute,
  unauthorizedRoute,
  createStaffRoutes(rootRoute),
  createMemberRoutes(rootRoute),
]);

export const router = createRouter({
  routeTree,
  context: { queryClient },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
