import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { cn } from '@/lib/utils';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  errorMessage?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  state?: 'empty' | 'no-results';
  className?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  errorMessage,
  emptyTitle = 'No records found',
  emptyDescription,
  state = 'empty',
  className,
}: DataTableProps<TData, TValue>) {
  // TanStack Table intentionally returns table helper functions from this hook.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return <LoadingState title="Loading records" />;
  }

  if (errorMessage) {
    return (
      <ErrorState
        description={errorMessage}
        title="Unable to load records"
      />
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={
          emptyDescription ??
          (state === 'no-results'
            ? 'Adjust the search or filters and try again.'
            : undefined)
        }
      />
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-md border bg-white', className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-normal text-slate-600">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th className="px-4 py-3 font-semibold" key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
            {table.getRowModel().rows.map((row) => (
              <tr className="hover:bg-slate-50" key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td className="px-4 py-3 text-slate-700" key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
