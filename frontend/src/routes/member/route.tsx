/* eslint-disable react-refresh/only-export-components */
import {
  Outlet,
  createRoute,
  lazyRouteComponent,
  type AnyRoute,
} from '@tanstack/react-router';
import { MemberShell } from '@/components/layout/member-shell';
import { requireMemberSession } from '@/lib/auth/route-guards';

const MemberHomeRoute = lazyRouteComponent(() => import('./index'), 'MemberHomeRoute');
const MemberBorrowingsRoute = lazyRouteComponent(
  () => import('./borrowings'),
  'MemberBorrowingsRoute',
);
const MemberBorrowingDetailRoute = lazyRouteComponent(
  () => import('./borrowings.$borrowingId'),
  'MemberBorrowingDetailRoute',
);

function MemberRouteLayout() {
  return (
    <MemberShell>
      <Outlet />
    </MemberShell>
  );
}

export function createMemberRoutes(parentRoute: AnyRoute) {
  const memberRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: 'member',
    beforeLoad: requireMemberSession,
    component: MemberRouteLayout,
  });

  const indexRoute = createRoute({
    getParentRoute: () => memberRoute,
    path: '/',
    component: MemberHomeRoute,
  });

  const borrowingsRoute = createRoute({
    getParentRoute: () => memberRoute,
    path: 'borrowings',
    component: MemberBorrowingsRoute,
  });

  const borrowingDetailRoute = createRoute({
    getParentRoute: () => memberRoute,
    path: 'borrowings/$borrowingId',
    component: MemberBorrowingDetailRoute,
  });

  return memberRoute.addChildren([
    indexRoute,
    borrowingsRoute,
    borrowingDetailRoute,
  ]);
}
