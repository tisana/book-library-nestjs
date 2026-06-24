import { Link } from '@tanstack/react-router';
import { CalendarDays } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import type { BorrowingView } from '@/lib/api/types';
import { formatLocalDate, getDueStatus } from '@/lib/dates/due-status';

interface BorrowedBooksListProps {
  borrowings: BorrowingView[];
  now?: Date;
}

const dueLabels = {
  returned: 'Returned',
  overdue: 'Overdue',
  'due-today': 'Due today',
  'due-soon': 'Due soon',
  open: 'On time',
} as const;

const dueTones = {
  returned: 'neutral',
  overdue: 'danger',
  'due-today': 'warning',
  'due-soon': 'warning',
  open: 'success',
} as const;

export function BorrowedBooksList({ borrowings, now }: BorrowedBooksListProps) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="borrowed-books">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="borrowed-books"
          className="text-base font-semibold text-slate-950"
        >
          Current borrowed books
        </h2>
        <span className="text-sm tabular-nums text-slate-500">
          {borrowings.length}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {borrowings.map((borrowing) => {
          const dueStatus = getDueStatus(borrowing.dueAt, {
            returnedAt: borrowing.returnedAt,
            now,
          });
          const title = borrowing.bookTitle ?? `Book ${borrowing.bookId}`;

          return (
            <article
              className="rounded-md border border-slate-200 bg-white p-4"
              key={borrowing.id}
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  className="min-w-0 text-base font-semibold text-slate-950 hover:text-cyan-800 hover:underline"
                  params={{ borrowingId: borrowing.id }}
                  to="/member/borrowings/$borrowingId"
                >
                  <span className="break-words">{title}</span>
                </Link>
                <StatusBadge tone={dueTones[dueStatus]}>
                  {dueLabels[dueStatus]}
                </StatusBadge>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <p className="flex min-h-6 items-center gap-2">
                  <CalendarDays className="size-4 shrink-0" aria-hidden />
                  Borrowed {formatLocalDate(borrowing.borrowedAt)}
                </p>
                <p className="flex min-h-6 items-center gap-2">
                  <CalendarDays className="size-4 shrink-0" aria-hidden />
                  Due {formatLocalDate(borrowing.dueAt)}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
