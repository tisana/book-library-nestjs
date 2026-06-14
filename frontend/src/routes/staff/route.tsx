/* eslint-disable react-refresh/only-export-components */
import { Outlet, createRoute, type AnyRoute } from '@tanstack/react-router';
import { PageHeader } from '@/components/page-header';
import { StaffShell } from '@/components/layout/staff-shell';
import { EmptyState } from '@/components/states';
import { requireStaffSession } from '@/lib/auth/route-guards';

function StaffRouteLayout() {
  return (
    <StaffShell>
      <Outlet />
    </StaffShell>
  );
}

function StaffDashboardPlaceholder() {
  return (
    <>
      <PageHeader
        description="Staff feature screens are implemented in the US1 phase."
        title="Back office dashboard"
      />
      <section className="p-5 sm:p-6">
        <EmptyState
          description="Books, members, catalog, and borrowing workflows will attach to this shell."
          title="Foundation ready"
        />
      </section>
    </>
  );
}

function StaffSectionPlaceholder({ title }: { title: string }) {
  return (
    <>
      <PageHeader
        description="This route is reserved for the staff workflow implementation phase."
        title={title}
      />
      <section className="p-5 sm:p-6">
        <EmptyState title={`${title} workspace pending`} />
      </section>
    </>
  );
}

export function createStaffRoutes(parentRoute: AnyRoute) {
  const staffRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: 'staff',
    beforeLoad: requireStaffSession,
    component: StaffRouteLayout,
  });

  const indexRoute = createRoute({
    getParentRoute: () => staffRoute,
    path: '/',
    component: StaffDashboardPlaceholder,
  });

  const booksRoute = createRoute({
    getParentRoute: () => staffRoute,
    path: 'books',
    component: () => <StaffSectionPlaceholder title="Books" />,
  });

  const membersRoute = createRoute({
    getParentRoute: () => staffRoute,
    path: 'members',
    component: () => <StaffSectionPlaceholder title="Members" />,
  });

  const borrowingsRoute = createRoute({
    getParentRoute: () => staffRoute,
    path: 'borrowings',
    component: () => <StaffSectionPlaceholder title="Borrowings" />,
  });

  return staffRoute.addChildren([
    indexRoute,
    booksRoute,
    membersRoute,
    borrowingsRoute,
  ]);
}
