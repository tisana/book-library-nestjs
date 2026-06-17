import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table/data-table';
import { StatusBadge } from '@/components/status-badge';
import { useOverdueBorrowings } from '@/lib/api/borrowings';
import type { BorrowingView } from '@/lib/api/types';
import { formatLocalDate } from '@/lib/dates/due-status';

export function StaffOverdueBorrowingsRoute() {
  const overdue = useOverdueBorrowings();
  const columns: ColumnDef<BorrowingView>[] = [
    { accessorKey: 'id', header: 'Borrowing ID' },
    { accessorKey: 'memberId', header: 'Member ID' },
    { accessorKey: 'bookId', header: 'Book ID' },
    {
      accessorKey: 'dueAt',
      header: 'Due',
      cell: ({ row }) => formatLocalDate(row.original.dueAt),
    },
    {
      header: 'Status',
      cell: () => <StatusBadge tone="danger">Overdue</StatusBadge>,
    },
  ];

  return (
    <>
      <PageHeader title="Overdue Borrowings" description="Records needing follow-up." />
      <section className="p-5 sm:p-6">
        <DataTable columns={columns} data={overdue.data ?? []} isLoading={overdue.isLoading} emptyTitle="No overdue borrowings" />
      </section>
    </>
  );
}
