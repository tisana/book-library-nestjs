/* eslint-disable react-refresh/only-export-components */
import { Outlet, createRoute, type AnyRoute } from '@tanstack/react-router';
import { PageHeader } from '@/components/page-header';
import { MemberShell } from '@/components/layout/member-shell';
import { EmptyState } from '@/components/states';
import { requireMemberSession } from '@/lib/auth/route-guards';

function MemberRouteLayout() {
  return (
    <MemberShell>
      <Outlet />
    </MemberShell>
  );
}

function MemberHomePlaceholder() {
  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        description="Mobile-first member status cards attach here in US2."
        title="Member home"
      />
      <EmptyState
        description="Membership tier, quota, current borrowing, and due-status views will use this shell."
        title="Member foundation ready"
      />
    </section>
  );
}

function MemberBorrowingsPlaceholder() {
  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        description="Member-only borrowing list and detail routes attach here in US2."
        title="My borrowed books"
      />
      <EmptyState title="Borrowing list pending" />
    </section>
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
    component: MemberHomePlaceholder,
  });

  const borrowingsRoute = createRoute({
    getParentRoute: () => memberRoute,
    path: 'borrowings',
    component: MemberBorrowingsPlaceholder,
  });

  return memberRoute.addChildren([indexRoute, borrowingsRoute]);
}
