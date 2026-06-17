import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { BookOpen } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { LoadingState, ErrorState } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { useBook } from '@/lib/api/books';

interface BookCoverThumbnailProps {
  coverImageUrl?: string;
  title: string;
}

function BookCoverThumbnail({ coverImageUrl, title }: BookCoverThumbnailProps) {
  const [hasImageError, setHasImageError] = useState(false);
  const shouldShowImage = coverImageUrl && !hasImageError;

  return (
    <article className="rounded-md border bg-white p-4">
      <h2 className="text-base font-semibold">Cover</h2>
      <div className="mt-3 aspect-[2/3] overflow-hidden rounded-md border bg-slate-100">
        {shouldShowImage ? (
          <img
            alt={`Cover thumbnail for ${title}`}
            className="h-full w-full object-cover"
            src={coverImageUrl}
            onError={() => setHasImageError(true)}
          />
        ) : (
          <div
            aria-label={`No cover thumbnail recorded for ${title}`}
            className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 text-center text-slate-500"
            role="img"
          >
            <BookOpen aria-hidden="true" className="h-10 w-10" />
            <span className="text-sm font-medium">No cover recorded</span>
          </div>
        )}
      </div>
    </article>
  );
}

export function StaffBookDetailRoute() {
  const { bookId } = useParams({ strict: false }) as { bookId: string };
  const book = useBook(bookId);

  if (book.isLoading) return <LoadingState title="Loading book" />;
  if (book.isError || !book.data) {
    return (
      <div className="p-5">
        <ErrorState
          title="Book not found"
          description="The selected book could not be loaded."
        />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={book.data.title}
        description={`${book.data.catalogIdentifier} by ${book.data.author ?? 'Unknown author'}`}
        actions={
          <StatusBadge
            tone={book.data.status === 'active' ? 'success' : 'neutral'}
          >
            {book.data.status}
          </StatusBadge>
        }
      />
      <section className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <BookCoverThumbnail
          coverImageUrl={book.data.coverImageUrl}
          title={book.data.title}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-md border bg-white p-4">
            <h2 className="text-base font-semibold">Availability</h2>
            <p className="mt-3 text-3xl font-semibold tabular-nums">
              {book.data.availableQuantity} of {book.data.totalQuantity}{' '}
              available
            </p>
            {book.data.availableQuantity === 0 ? (
              <p className="mt-2 text-sm text-amber-700">
                No copies are currently available for borrowing.
              </p>
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
        </div>
      </section>
    </>
  );
}
