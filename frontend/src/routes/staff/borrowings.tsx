import { Link } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table/data-table';
import { StatusBadge } from '@/components/status-badge';
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
          {row.original.id}
        </Link>
      ),
    },
    { accessorKey: 'memberId', header: 'Member ID' },
    { accessorKey: 'bookId', header: 'Book ID' },
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
