import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Search } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { FormField, TextInput } from '@/components/forms';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { BookForm } from '@/features/books/book-form';
import { useCatalog } from '@/lib/api/catalog';
import { useBooks, useCreateBook } from '@/lib/api/books';
import { toMutationError } from '@/lib/api/errors';
import type { BookView } from '@/lib/api/types';

export function StaffBooksRoute() {
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState<string>();
  const books = useBooks({ q });
  const catalog = useCatalog();
  const createBook = useCreateBook();
  const columns: ColumnDef<BookView>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <Link
          className="font-medium text-cyan-800 hover:underline"
          params={{ bookId: row.original.id }}
          to="/staff/books/$bookId"
        >
          {row.original.title}
        </Link>
      ),
    },
    { accessorKey: 'catalogIdentifier', header: 'Catalog ID' },
    { accessorKey: 'author', header: 'Author' },
    {
      header: 'Availability',
      cell: ({ row }) =>
        `${row.original.availableQuantity} of ${row.original.totalQuantity}`,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge tone={row.original.status === 'active' ? 'success' : 'neutral'}>
          {row.original.status}
        </StatusBadge>
      ),
    },
  ];

  async function handleCreate(input: Parameters<typeof createBook.mutateAsync>[0]) {
    try {
      await createBook.mutateAsync(input);
      setNotice('Book saved');
      setShowForm(false);
    } catch (error) {
      throw new Error(toMutationError(error).message, { cause: error });
    }
  }

  return (
    <>
      <PageHeader
        title="Book Collection"
        description="Search, add, and inspect library books."
        actions={
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white"
            onClick={() => setShowForm((value) => !value)}
            type="button"
          >
            <Plus className="size-4" aria-hidden />
            Add book
          </button>
        }
      />
      <section className="flex flex-col gap-4 p-5 sm:p-6">
        <FormField htmlFor="book-search" label="Search books">
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" aria-hidden />
            <TextInput
              className="pl-9"
              id="book-search"
              onChange={(event) => setQ(event.target.value)}
              placeholder="Title or catalog identifier"
              value={q}
            />
          </div>
        </FormField>
        {notice ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}
        {showForm ? (
          <section className="max-w-2xl rounded-md border bg-white p-4">
            <h2 className="mb-4 text-base font-semibold">Add book</h2>
            <BookForm categories={catalog.data ?? []} onSubmit={handleCreate} />
          </section>
        ) : null}
        <DataTable
          columns={columns}
          data={books.data ?? []}
          emptyTitle={q ? 'No matching books' : 'No books yet'}
          errorMessage={books.isError ? 'The book list could not be loaded.' : undefined}
          isLoading={books.isLoading || catalog.isLoading}
          state={q ? 'no-results' : 'empty'}
        />
      </section>
    </>
  );
}
