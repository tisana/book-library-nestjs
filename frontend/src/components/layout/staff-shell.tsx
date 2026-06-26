import type { ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  BookOpen,
  ClipboardList,
  Layers,
  Library,
  LogOut,
  ShieldAlert,
  Ticket,
  Users,
} from 'lucide-react';
import { staffLogout } from '@/lib/api/auth';
import { cn } from '@/lib/utils';

const staffNavItems = [
  { to: '/staff', label: 'Dashboard', icon: Library },
  { to: '/staff/books', label: 'Books', icon: BookOpen },
  { to: '/staff/catalog', label: 'Catalog', icon: Layers },
  { to: '/staff/membership-types', label: 'Membership', icon: Ticket },
  { to: '/staff/members', label: 'Members', icon: Users },
  { to: '/staff/borrowings', label: 'Borrowings', icon: ClipboardList },
  { to: '/staff/borrowings/new', label: 'New borrowing', icon: ClipboardList },
  { to: '/staff/borrowings/overdue', label: 'Overdue', icon: ShieldAlert },
] as const;

export function StaffShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  function handleSignOut() {
    void navigate({ to: staffLogout() });
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
          {staffNavItems.map(({ to, label, icon: Icon }) => (
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
          {staffNavItems.map(({ to, label, icon: Icon }) => (
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
