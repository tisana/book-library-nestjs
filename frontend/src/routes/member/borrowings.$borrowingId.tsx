import { Link, useParams } from '@tanstack/react-router';
import { PageHeader } from '@/components/page-header';
import { ErrorState, LoadingState } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { useMyBorrowing } from '@/lib/api/member-self-service';
import type { BorrowingView } from '@/lib/api/types';
import { formatLocalDate, getDueStatus } from '@/lib/dates/due-status';

export function MemberBorrowingDetailRoute() {
  const { borrowingId } = useParams({ strict: false }) as {
    borrowingId: string;
  };
  const borrowing = useMyBorrowing(borrowingId);

  if (borrowing.isLoading) {
    return <LoadingState title="Loading borrowed book" />;
  }

  if (borrowing.isError || !borrowing.data) {
    return (
      <ErrorState
        action={
          <Link
            className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white"
            to="/member/borrowings"
          >
            Back to books
          </Link>
        }
        description="This record was not found for your member account."
        title="Borrowing unavailable"
      />
    );
  }

  return <BorrowingDetail borrowing={borrowing.data} />;
}

function BorrowingDetail({ borrowing }: { borrowing: BorrowingView }) {
  const dueStatus = getDueStatus(borrowing.dueAt, {
    returnedAt: borrowing.returnedAt,
  });
  const title = borrowing.bookTitle ?? `Book ${borrowing.bookId}`;

  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        description={`Borrowing ${borrowing.id}`}
        title={title}
        actions={
          <StatusBadge tone={dueStatus === 'overdue' ? 'danger' : 'success'}>
            {toTitle(dueStatus.replace('-', ' '))}
          </StatusBadge>
        }
      />
      <article className="rounded-md border bg-white p-4">
        <dl className="grid gap-3 text-sm">
          <DetailRow
            label="Borrowed"
            value={formatLocalDate(borrowing.borrowedAt)}
          />
          <DetailRow label="Due" value={formatLocalDate(borrowing.dueAt)} />
          <DetailRow label="Status" value={toTitle(borrowing.status)} />
          {borrowing.returnedAt ? (
            <DetailRow
              label="Returned"
              value={formatLocalDate(borrowing.returnedAt)}
            />
          ) : null}
        </dl>
      </article>
      <p className="rounded-md border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950">
        Bring this book to the library desk when you are ready to return it.
      </p>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-950">{value}</dd>
    </div>
  );
}

function toTitle(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
