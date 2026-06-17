import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader } from '@/components/page-header';
import { ErrorState, LoadingState } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { useBooks } from '@/lib/api/books';
import { useCreateBorrowing, useOverdueBorrowings } from '@/lib/api/borrowings';
import { toMutationError } from '@/lib/api/errors';
import { useMemberPolicy, useMembers } from '@/lib/api/members';

export function StaffNewBorrowingRoute() {
  const [memberId, setMemberId] = useState('');
  const [bookId, setBookId] = useState('');
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const members = useMembers();
  const books = useBooks();
  const overdue = useOverdueBorrowings();
  const policy = useMemberPolicy(memberId);
  const createBorrowing = useCreateBorrowing();
  const selectedMember = members.data?.find((member) => member.id === memberId);
  const selectedBook = books.data?.find((book) => book.id === bookId);
  const blockingReasons = useMemo(() => {
    const reasons: string[] = [];
    if (selectedMember?.status === 'suspended') reasons.push('Member is suspended');
    if (selectedMember?.status === 'inactive') reasons.push('Member is inactive');
    if (policy.data?.limitReached) reasons.push('Quota reached');
    if (selectedBook?.status !== undefined && selectedBook.status !== 'active') {
      reasons.push('Book is inactive');
    }
    if (selectedBook && selectedBook.availableQuantity <= 0) {
      reasons.push('Book has no available copies');
    }
    if (overdue.data?.some((item) => item.memberId === memberId)) {
      reasons.push('Member has overdue borrowings');
    }
    return reasons;
  }, [memberId, overdue.data, policy.data, selectedBook, selectedMember]);
  const canSubmit = Boolean(memberId && bookId) && blockingReasons.length === 0;

  if (members.isLoading || books.isLoading || overdue.isLoading) {
    return <LoadingState title="Loading borrowing console" />;
  }

  if (members.isError || books.isError) {
    return <ErrorState title="Borrowing console unavailable" description="Members or books could not be loaded." />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(undefined);
    setError(undefined);
    if (!canSubmit) return;

    try {
      await createBorrowing.mutateAsync({ memberId, bookId });
      setNotice('Borrowing recorded');
    } catch (caught) {
      setError(toMutationError(caught).message);
    }
  }

  return (
    <>
      <PageHeader title="Record Borrowing" description="Select a member and available book before submitting." />
      <form className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_22rem]" onSubmit={submit}>
        <section className="rounded-md border bg-white p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Member
              <select
                className="h-10 rounded-md border bg-white px-3 text-sm"
                onChange={(event) => setMemberId(event.target.value)}
                value={memberId}
              >
                <option value="">Choose member</option>
                {members.data?.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.memberNumber} - {member.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Book
              <select
                className="h-10 rounded-md border bg-white px-3 text-sm"
                onChange={(event) => setBookId(event.target.value)}
                value={bookId}
              >
                <option value="">Choose book</option>
                {books.data?.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.catalogIdentifier} - {book.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {notice ? <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}
          {error ? <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        </section>
        <aside className="rounded-md border bg-white p-4">
          <h2 className="text-base font-semibold">Eligibility summary</h2>
          {policy.isLoading && memberId ? <p className="mt-3 text-sm text-slate-600">Loading policy...</p> : null}
          {blockingReasons.length === 0 && memberId && bookId ? (
            <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              Eligible to borrow
            </p>
          ) : null}
          {blockingReasons.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2">
              {blockingReasons.map((reason) => (
                <li className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800" key={reason}>
                  {reason}
                  <StatusBadge tone={reason.includes('suspended') || reason.includes('inactive') ? 'danger' : 'warning'}>
                    Blocked
                  </StatusBadge>
                </li>
              ))}
            </ul>
          ) : null}
          <button
            className="mt-4 w-full rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={!canSubmit || createBorrowing.isPending}
            type="submit"
          >
            Record borrowing
          </button>
        </aside>
      </form>
    </>
  );
}
