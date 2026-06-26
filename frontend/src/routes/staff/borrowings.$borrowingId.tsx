import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { ConfirmationDialog } from '@/components/forms';
import { PageHeader } from '@/components/page-header';
import { ErrorState, LoadingState } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import {
  getBookDisplay,
  getBorrowingDisplay,
  getMemberDisplay,
} from '@/features/borrowings/borrowing-display';
import { useBorrowing, useReturnBorrowing } from '@/lib/api/borrowings';
import { toMutationError } from '@/lib/api/errors';
import { formatLocalDate } from '@/lib/dates/due-status';

export function StaffBorrowingDetailRoute() {
  const { borrowingId } = useParams({ strict: false }) as { borrowingId: string };
  const borrowing = useBorrowing(borrowingId);
  const returnBorrowing = useReturnBorrowing(borrowingId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  if (borrowing.isLoading) return <LoadingState title="Loading borrowing" />;
  if (borrowing.isError || !borrowing.data) {
    return (
      <div className="p-5">
        <ErrorState title="Borrowing not found" description="The borrowing record could not be loaded." />
      </div>
    );
  }

  async function handleReturn() {
    setError(undefined);
    try {
      await returnBorrowing.mutateAsync({});
      setNotice('Return recorded');
      setConfirmOpen(false);
    } catch (caught) {
      setError(toMutationError(caught).message);
    }
  }

  const member = getMemberDisplay(borrowing.data);
  const book = getBookDisplay(borrowing.data);

  return (
    <>
      <PageHeader
        title={getBorrowingDisplay(borrowing.data)}
        description={`Borrowing ${borrowing.data.id} · Due ${formatLocalDate(borrowing.data.dueAt)}`}
        actions={
          <StatusBadge tone={borrowing.data.status === 'overdue' ? 'danger' : borrowing.data.status === 'returned' ? 'neutral' : 'success'}>
            {borrowing.data.status}
          </StatusBadge>
        }
      />
      <section className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <article className="rounded-md border bg-white p-4">
          <h2 className="text-base font-semibold">Record details</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Member</dt>
              <dd className="text-right">
                <span className="block font-medium text-slate-950">{member.primary}</span>
                <span className="text-xs text-slate-500">{member.secondary}</span>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Book</dt>
              <dd className="text-right">
                <span className="block font-medium text-slate-950">{book.primary}</span>
                <span className="text-xs text-slate-500">{book.secondary}</span>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Borrowed</dt>
              <dd>{formatLocalDate(borrowing.data.borrowedAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Returned</dt>
              <dd>{borrowing.data.returnedAt ? formatLocalDate(borrowing.data.returnedAt) : 'Not returned'}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t pt-2">
              <dt className="text-slate-500">Member ID</dt>
              <dd className="text-xs text-slate-500">{borrowing.data.memberId}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Book ID</dt>
              <dd className="text-xs text-slate-500">{borrowing.data.bookId}</dd>
            </div>
          </dl>
        </article>
        <aside className="rounded-md border bg-white p-4">
          <h2 className="text-base font-semibold">Return workflow</h2>
          <p className="mt-2 text-sm text-slate-600">Record a return when the book is physically received.</p>
          {notice ? <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">{notice}</p> : null}
          {error ? <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">{error}</p> : null}
          <button
            className="mt-4 w-full rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-400"
            disabled={borrowing.data.status === 'returned'}
            onClick={() => setConfirmOpen(true)}
            type="button"
          >
            Record return
          </button>
        </aside>
      </section>
      <ConfirmationDialog
        description="Confirm that this book has been returned to the library."
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleReturn}
        open={confirmOpen}
        title="Record return"
      />
    </>
  );
}
