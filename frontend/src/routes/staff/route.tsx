/* eslint-disable react-refresh/only-export-components */
import {
  Outlet,
  createRoute,
  lazyRouteComponent,
  type AnyRoute,
  useLocation,
} from '@tanstack/react-router';
import { StaffShell } from '@/components/layout/staff-shell';
import { StaffLoginRoute } from '@/routes/public';
import { requireStaffSession } from '@/lib/auth/route-guards';
import { requireStaffPermission } from '@/lib/auth/route-guards';
import { StaffRouteErrorBoundary } from './error-boundary';

const StaffDashboard = lazyRouteComponent(
  () => import('@/features/staff-dashboard/staff-dashboard'),
  'StaffDashboard',
);
const StaffBooksRoute = lazyRouteComponent(() => import('./books'), 'StaffBooksRoute');
const StaffBookDetailRoute = lazyRouteComponent(
  () => import('./books.$bookId'),
  'StaffBookDetailRoute',
);
const StaffCatalogRoute = lazyRouteComponent(() => import('./catalog'), 'StaffCatalogRoute');
const StaffMembershipTypesRoute = lazyRouteComponent(
  () => import('./membership-types'),
  'StaffMembershipTypesRoute',
);
const StaffMembersRoute = lazyRouteComponent(() => import('./members'), 'StaffMembersRoute');
const StaffMemberDetailRoute = lazyRouteComponent(
  () => import('./members.$memberId'),
  'StaffMemberDetailRoute',
);
const StaffBorrowingsRoute = lazyRouteComponent(
  () => import('./borrowings'),
  'StaffBorrowingsRoute',
);
const StaffNewBorrowingRoute = lazyRouteComponent(
  () => import('./borrowings.new'),
  'StaffNewBorrowingRoute',
);
const StaffOverdueBorrowingsRoute = lazyRouteComponent(
  () => import('./borrowings.overdue'),
  'StaffOverdueBorrowingsRoute',
);
const StaffBorrowingDetailRoute = lazyRouteComponent(
  () => import('./borrowings.$borrowingId'),
  'StaffBorrowingDetailRoute',
);
const StaffUsersRoute = lazyRouteComponent(
  () => import('./staff-users'),
  'StaffUsersRoute',
);
const IdentifierConflictsRoute = lazyRouteComponent(
  () => import('./identifier-conflicts'),
  'IdentifierConflictsRoute',
);

function StaffRouteLayout() {
  const location = useLocation();

  if (location.pathname === '/staff/login') {
    return <Outlet />;
  }

  return (
    <StaffShell>
      <Outlet />
    </StaffShell>
  );
}

export function createStaffRoutes(parentRoute: AnyRoute) {
  const staffRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: 'staff',
    beforeLoad: requireStaffSession,
    component: StaffRouteLayout,
    errorComponent: StaffRouteErrorBoundary,
  });

  const indexRoute = createRoute({
    getParentRoute: () => staffRoute,
    path: '/',
    component: StaffDashboard,
  });

  const staffLoginRoute = createRoute({
    getParentRoute: () => staffRoute,
    path: 'login',
    component: StaffLoginRoute,
  });

  const booksRoute = createRoute({
    getParentRoute: () => staffRoute,
    path: 'books',
    component: StaffBooksRoute,
  });

  const bookDetailRoute = createRoute({
    getParentRoute: () => staffRoute,
    path: 'books/$bookId',
    component: StaffBookDetailRoute,
  });

  const catalogRoute = createRoute({
    getParentRoute: () => staffRoute,
    path: 'catalog',
    component: StaffCatalogRoute,
  });

  const membershipTypesRoute = createRoute({
    getParentRoute: () => staffRoute,
    path: 'membership-types',
    component: StaffMembershipTypesRoute,
  });

  const membersRoute = createRoute({
    getParentRoute: () => staffRoute,
    path: 'members',
    component: StaffMembersRoute,
  });

  const memberDetailRoute = createRoute({
    getParentRoute: () => staffRoute,
    path: 'members/$memberId',
    component: StaffMemberDetailRoute,
  });

  const borrowingsRoute = createRoute({
    getParentRoute: () => staffRoute,
    path: 'borrowings',
    component: StaffBorrowingsRoute,
  });

  const newBorrowingRoute = createRoute({
    getParentRoute: () => staffRoute,
    path: 'borrowings/new',
    component: StaffNewBorrowingRoute,
  });

  const overdueBorrowingsRoute = createRoute({
    getParentRoute: () => staffRoute,
    path: 'borrowings/overdue',
    component: StaffOverdueBorrowingsRoute,
  });

  const borrowingDetailRoute = createRoute({
    getParentRoute: () => staffRoute,
    path: 'borrowings/$borrowingId',
    component: StaffBorrowingDetailRoute,
  });

  const staffUsersRoute = createRoute({
    getParentRoute: () => staffRoute,
    path: 'users',
    beforeLoad: () => {
      requireStaffPermission('staff-users:read');
      return requireStaffPermission('roles:read');
    },
    component: StaffUsersRoute,
  });

  const identifierConflictsRoute = createRoute({
    getParentRoute: () => staffRoute,
    path: 'identifier-conflicts',
    beforeLoad: () => requireStaffPermission('auth-identifiers:read'),
    component: IdentifierConflictsRoute,
  });

  return staffRoute.addChildren([
    indexRoute,
    staffLoginRoute,
    booksRoute,
    bookDetailRoute,
    catalogRoute,
    membershipTypesRoute,
    membersRoute,
    memberDetailRoute,
    borrowingsRoute,
    newBorrowingRoute,
    overdueBorrowingsRoute,
    borrowingDetailRoute,
    staffUsersRoute,
    identifierConflictsRoute,
  ]);
}
