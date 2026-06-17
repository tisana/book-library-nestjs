import { useParams } from '@tanstack/react-router';
import { PageHeader } from '@/components/page-header';
import { LoadingState, ErrorState } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { useBook } from '@/lib/api/books';

export function StaffBookDetailRoute() {
  const { bookId } = useParams({ strict: false }) as { bookId: string };
  const book = useBook(bookId);

  if (book.isLoading) return <LoadingState title="Loading book" />;
  if (book.isError || !book.data) {
    return (
      <div className="p-5">
        <ErrorState title="Book not found" description="The selected book could not be loaded." />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={book.data.title}
        description={`${book.data.catalogIdentifier} by ${book.data.author ?? 'Unknown author'}`}
        actions={
          <StatusBadge tone={book.data.status === 'active' ? 'success' : 'neutral'}>
            {book.data.status}
          </StatusBadge>
        }
      />
      <section className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <article className="rounded-md border bg-white p-4">
          <h2 className="text-base font-semibold">Availability</h2>
          <p className="mt-3 text-3xl font-semibold tabular-nums">
            {book.data.availableQuantity} of {book.data.totalQuantity} available
          </p>
          {book.data.availableQuantity === 0 ? (
            <p className="mt-2 text-sm text-amber-700">No copies are currently available for borrowing.</p>
          ) : null}
        </article>
        <article className="rounded-md border bg-white p-4">
          <h2 className="text-base font-semibold">Catalog details</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">ISBN</dt>
              <dd>{book.data.isbn ?? 'Not recorded'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Category ID</dt>
              <dd className="truncate">{book.data.categoryId}</dd>
            </div>
          </dl>
        </article>
      </section>
    </>
  );
}
