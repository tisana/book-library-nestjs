import { Link } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table/data-table';
import { StatusBadge } from '@/components/status-badge';
import {
  getBookDisplay,
  getBorrowingDisplay,
  getMemberDisplay,
} from '@/features/borrowings/borrowing-display';
import { useBorrowings } from '@/lib/api/borrowings';
import type { BorrowingView } from '@/lib/api/types';
import { formatLocalDate } from '@/lib/dates/due-status';

export function StaffBorrowingsRoute() {
  const borrowings = useBorrowings();
  const columns: ColumnDef<BorrowingView>[] = [
    {
      accessorKey: 'id',
      header: 'Borrowing',
      cell: ({ row }) => (
        <Link
          className="font-medium text-cyan-800 hover:underline"
          params={{ borrowingId: row.original.id }}
          to="/staff/borrowings/$borrowingId"
        >
          {getBorrowingDisplay(row.original)}
        </Link>
      ),
    },
    {
      header: 'Member',
      cell: ({ row }) => {
        const member = getMemberDisplay(row.original);
        return <TwoLineCell primary={member.primary} secondary={member.secondary} />;
      },
    },
    {
      header: 'Book',
      cell: ({ row }) => {
        const book = getBookDisplay(row.original);
        return <TwoLineCell primary={book.primary} secondary={book.secondary} />;
      },
    },
    {
      accessorKey: 'dueAt',
      header: 'Due',
      cell: ({ row }) => formatLocalDate(row.original.dueAt),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge tone={row.original.status === 'overdue' ? 'danger' : row.original.status === 'returned' ? 'neutral' : 'success'}>
          {row.original.status}
        </StatusBadge>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Borrowing Management"
        description="Review active and historical lending records."
        actions={
          <Link className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white" to="/staff/borrowings/new">
            New borrowing
          </Link>
        }
      />
      <section className="p-5 sm:p-6">
        <DataTable columns={columns} data={borrowings.data ?? []} isLoading={borrowings.isLoading} emptyTitle="No borrowings yet" />
      </section>
    </>
  );
}

function TwoLineCell({
  primary,
  secondary,
}: {
  primary: string;
  secondary: string;
}) {
  return (
    <div className="min-w-48">
      <p className="font-medium text-slate-950">{primary}</p>
      <p className="mt-1 text-xs text-slate-500">{secondary}</p>
    </div>
  );
}
