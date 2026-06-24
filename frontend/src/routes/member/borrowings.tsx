import { PageHeader } from '@/components/page-header';
import { ErrorState, LoadingState } from '@/components/states';
import { BorrowedBooksList } from '@/features/member-home/borrowed-books-list';
import { NoCurrentBorrowingsState } from '@/features/member-home/member-empty-states';
import { useMyBorrowings } from '@/lib/api/member-self-service';

export function MemberBorrowingsRoute() {
  const borrowings = useMyBorrowings({ limit: 20 });

  if (borrowings.isLoading) {
    return <LoadingState title="Loading borrowed books" />;
  }

  if (borrowings.isError) {
    return (
      <ErrorState
        description="Your borrowing records could not be loaded."
        title="Borrowing list unavailable"
      />
    );
  }

  const records = borrowings.data ?? [];

  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        description="Current and recent books connected to your membership."
        title="My borrowed books"
      />
      {records.length > 0 ? (
        <BorrowedBooksList borrowings={records} />
      ) : (
        <NoCurrentBorrowingsState />
      )}
    </section>
  );
}
