import type { ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { BookMarked, Home, LogOut } from 'lucide-react';
import { memberLogout } from '@/lib/api/member-auth';

const memberNavItems = [
  { to: '/member', label: 'Home', icon: Home },
  { to: '/member/borrowings', label: 'Books', icon: BookMarked },
] as const;

export function MemberShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  async function handleSignOut() {
    const to = await memberLogout();
    await navigate({ to });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-10 border-b bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950">Book Library</p>
            <p className="text-xs text-slate-500">Member access</p>
          </div>
          <button
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
            onClick={handleSignOut}
            type="button"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-md overflow-x-hidden px-4 py-4">
        {children}
      </main>
      <nav
        aria-label="Member navigation"
        className="sticky bottom-0 border-t bg-white px-4 py-2"
      >
        <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
          {memberNavItems.map(({ to, label, icon: Icon }) => (
            <Link
              activeProps={{
                className: 'bg-cyan-50 text-cyan-800',
              }}
              className="flex min-h-11 items-center justify-center gap-2 rounded-md px-2 text-sm font-medium text-slate-700"
              key={to}
              to={to}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
