import type { ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  BookOpen,
  ClipboardList,
  Layers,
  Library,
  LogOut,
  ShieldAlert,
  Fingerprint,
  Ticket,
  Users,
  UserRoundCog,
} from 'lucide-react';
import { staffLogout } from '@/lib/api/auth';
import { cn } from '@/lib/utils';
import { useAuthSession } from '@/lib/auth/session';
import type { AuthPermission } from '@/lib/api/types';

const staffNavItems = [
  { to: '/staff', label: 'Dashboard', icon: Library, permissions: [] },
  { to: '/staff/books', label: 'Books', icon: BookOpen, permissions: ['catalog:read'] },
  { to: '/staff/catalog', label: 'Catalog', icon: Layers, permissions: ['catalog:read'] },
  { to: '/staff/membership-types', label: 'Membership', icon: Ticket, permissions: ['membership-types:read'] },
  { to: '/staff/members', label: 'Members', icon: Users, permissions: ['members:read'] },
  { to: '/staff/borrowings', label: 'Borrowings', icon: ClipboardList, permissions: ['borrowings:read'] },
  { to: '/staff/borrowings/new', label: 'New borrowing', icon: ClipboardList, permissions: ['borrowings:manage'] },
  { to: '/staff/borrowings/overdue', label: 'Overdue', icon: ShieldAlert, permissions: ['borrowings:read'] },
  { to: '/staff/users', label: 'Staff access', icon: UserRoundCog, permissions: ['staff-users:read', 'roles:read'] },
  { to: '/staff/identifier-conflicts', label: 'Identifier conflicts', icon: Fingerprint, permissions: ['auth-identifiers:read'] },
] as const;

export function StaffShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const session = useAuthSession();
  const visibleNavItems = staffNavItems.filter((item) =>
    item.permissions.every((permission) =>
      session.permissions?.includes(permission as AuthPermission),
    ),
  );

  async function handleSignOut() {
    const to = await staffLogout();
    await navigate({ to });
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-white lg:flex">
        <div className="border-b px-5 py-5">
          <p className="text-sm font-semibold uppercase tracking-normal text-cyan-700">
            Library Admin
          </p>
          <p className="mt-1 text-xs text-slate-500">Back office workspace</p>
        </div>
        <nav
          className="flex flex-1 flex-col gap-1 p-3"
          aria-label="Staff navigation"
        >
          {visibleNavItems.map(({ to, label, icon: Icon }) => (
            <Link
              activeProps={{
                className: 'bg-cyan-50 text-cyan-800',
              }}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100',
              )}
              key={to}
              to={to}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t p-3">
          <button
            className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
            onClick={handleSignOut}
            type="button"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </button>
        </div>
      </aside>
      <div className="lg:pl-64">
        <div className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b bg-white px-3 py-2 lg:hidden">
          {visibleNavItems.map(({ to, label, icon: Icon }) => (
            <Link
              activeProps={{
                className: 'bg-cyan-50 text-cyan-800',
              }}
              className="flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-slate-700"
              key={to}
              to={to}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
          <button
            className="flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-slate-700"
            onClick={handleSignOut}
            type="button"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </button>
        </div>
        <main>{children}</main>
      </div>
    </div>
  );
}
