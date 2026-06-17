/* eslint-disable react-refresh/only-export-components */
import {
  Outlet,
  createRoute,
  type AnyRoute,
  useLocation,
} from '@tanstack/react-router';
import { StaffShell } from '@/components/layout/staff-shell';
import { StaffLoginRoute } from '@/routes/public';
import { StaffDashboard } from '@/features/staff-dashboard/staff-dashboard';
import { requireStaffSession } from '@/lib/auth/route-guards';
import { StaffRouteErrorBoundary } from './error-boundary';
import { StaffBooksRoute } from './books';
import { StaffBookDetailRoute } from './books.$bookId';
import { StaffCatalogRoute } from './catalog';
import { StaffMembershipTypesRoute } from './membership-types';
import { StaffMembersRoute } from './members';
import { StaffMemberDetailRoute } from './members.$memberId';
import { StaffBorrowingsRoute } from './borrowings';
import { StaffNewBorrowingRoute } from './borrowings.new';
import { StaffOverdueBorrowingsRoute } from './borrowings.overdue';
import { StaffBorrowingDetailRoute } from './borrowings.$borrowingId';

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
  ]);
}
