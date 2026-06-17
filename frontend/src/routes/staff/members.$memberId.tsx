import { useParams } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { PageHeader } from '@/components/page-header';
import { ErrorState, LoadingState } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { useMember, useMemberBorrowings, useMemberPolicy } from '@/lib/api/members';
import type { BorrowingView } from '@/lib/api/types';
import { formatLocalDate } from '@/lib/dates/due-status';

export function StaffMemberDetailRoute() {
  const { memberId } = useParams({ strict: false }) as { memberId: string };
  const member = useMember(memberId);
  const policy = useMemberPolicy(memberId);
  const borrowings = useMemberBorrowings(memberId);
  const columns: ColumnDef<BorrowingView>[] = [
    { accessorKey: 'id', header: 'Borrowing ID' },
    { accessorKey: 'bookId', header: 'Book ID' },
    {
      accessorKey: 'dueAt',
      header: 'Due date',
      cell: ({ row }) => formatLocalDate(row.original.dueAt),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge tone={row.original.status === 'returned' ? 'neutral' : row.original.status === 'overdue' ? 'danger' : 'success'}>
          {toTitle(row.original.status)}
        </StatusBadge>
      ),
    },
  ];

  if (member.isLoading || policy.isLoading || borrowings.isLoading) {
    return <LoadingState title="Loading member" />;
  }

  if (member.isError || !member.data) {
    return (
      <div className="p-5">
        <ErrorState title="Member not found" description="The selected member could not be loaded." />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={member.data.fullName}
        description={`${member.data.memberNumber} · ${member.data.email ?? 'No email recorded'}`}
        actions={
          <StatusBadge tone={member.data.status === 'active' ? 'success' : 'danger'}>
            {member.data.status}
          </StatusBadge>
        }
      />
      <section className="grid gap-4 p-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4">
          <article className="rounded-md border bg-white p-4">
            <h2 className="text-base font-semibold">Eligibility</h2>
            <dl className="mt-3 grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Active loans</dt>
                <dd>{policy.data?.activeLoanCount ?? member.data.activeLoanCount}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Loan limit</dt>
                <dd>{policy.data?.maxActiveLoans ?? 'Unknown'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Remaining quota</dt>
                <dd>{policy.data?.remainingAllowance ?? 'Unknown'}</dd>
              </div>
            </dl>
            {policy.data?.limitReached ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
                Member has reached the active borrowing limit.
              </p>
            ) : null}
          </article>
          <p className="rounded-md border bg-white p-3 text-sm text-slate-600">
            Historical records remain visible even when related books or catalog records are inactive.
          </p>
        </aside>
        <DataTable
          columns={columns}
          data={borrowings.data ?? []}
          emptyTitle="No borrowing history"
          errorMessage={borrowings.isError ? 'Borrowing history could not be loaded.' : undefined}
        />
      </section>
    </>
  );
}

function toTitle(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
