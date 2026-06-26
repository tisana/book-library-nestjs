import { Link } from '@tanstack/react-router';
import type { ComponentType, ReactNode } from 'react';
import { AlertTriangle, BookOpen, ClipboardList, Users } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { LoadingState, ErrorState } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { useBooks } from '@/lib/api/books';
import { useBorrowings, useOverdueBorrowings } from '@/lib/api/borrowings';
import { useMembers } from '@/lib/api/members';
import {
  getBookDisplay,
  getBorrowingDisplay,
  getMemberDisplay,
} from '@/features/borrowings/borrowing-display';
import { formatLocalDate } from '@/lib/dates/due-status';

export function StaffDashboard() {
  const books = useBooks();
  const members = useMembers();
  const borrowings = useBorrowings();
  const overdue = useOverdueBorrowings();
  const isLoading =
    books.isLoading || members.isLoading || borrowings.isLoading || overdue.isLoading;
  const hasError =
    books.isError || members.isError || borrowings.isError || overdue.isError;

  if (isLoading) return <LoadingState title="Loading dashboard" />;
  if (hasError) {
    return (
      <ErrorState
        title="Dashboard unavailable"
        description="One or more staff summaries could not be loaded."
      />
    );
  }

  const unavailableBooks = (books.data ?? []).filter(
    (book) => book.availableQuantity === 0 || book.status !== 'active',
  );
  const membersAtLimit = (members.data ?? []).filter(
    (member) => member.activeLoanCount >= 3,
  );

  return (
    <>
      <PageHeader
        title="Back office dashboard"
        description="Daily circulation status and quick access to staff workflows."
        actions={
          <Link
            className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white"
            to="/staff/borrowings/new"
          >
            New borrowing
          </Link>
        }
      />
      <section className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={ClipboardList} label="Active borrowings" value={borrowings.data?.length ?? 0} />
        <SummaryCard icon={AlertTriangle} label="Overdue borrowings" value={overdue.data?.length ?? 0} tone="warning" />
        <SummaryCard icon={BookOpen} label="Unavailable books" value={unavailableBooks.length} />
        <SummaryCard icon={Users} label="Members at limit" value={membersAtLimit.length} />
      </section>
      <section className="grid gap-4 px-5 pb-5 xl:grid-cols-2">
        <Panel title="Attention list">
          {(overdue.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-600">No overdue borrowings.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {overdue.data?.slice(0, 5).map((item) => (
                <li className="flex items-start justify-between gap-3 rounded-md border p-3" key={item.id}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-950">
                      {getBorrowingDisplay(item)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {getMemberDisplay(item).secondary} · {getBookDisplay(item).secondary} · Due {formatLocalDate(item.dueAt)}
                    </p>
                  </div>
                  <StatusBadge tone="danger">Overdue</StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Recent books">
          <ul className="flex flex-col gap-2">
            {(books.data ?? []).slice(0, 5).map((book) => (
              <li className="flex items-center justify-between rounded-md border p-3" key={book.id}>
                <span className="text-sm font-medium">{book.title}</span>
                <span className="text-xs text-slate-500">{book.catalogIdentifier}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </section>
    </>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  value: number;
  tone?: 'default' | 'warning';
}) {
  return (
    <article className="rounded-md border bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">{label}</p>
        <Icon
          className={tone === 'warning' ? 'size-5 text-amber-600' : 'size-5 text-cyan-700'}
          aria-hidden
        />
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums text-slate-950">{value}</p>
    </article>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border bg-white p-4">
      <h2 className="mb-3 text-base font-semibold text-slate-950">{title}</h2>
      {children}
    </section>
  );
}
