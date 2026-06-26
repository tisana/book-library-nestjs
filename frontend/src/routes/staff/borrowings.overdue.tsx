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
import { useOverdueBorrowings } from '@/lib/api/borrowings';
import type { BorrowingView } from '@/lib/api/types';
import { formatLocalDate } from '@/lib/dates/due-status';

export function StaffOverdueBorrowingsRoute() {
  const overdue = useOverdueBorrowings();
  const columns: ColumnDef<BorrowingView>[] = [
    {
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
