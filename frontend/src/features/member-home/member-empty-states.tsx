import { BookOpenCheck, Library } from 'lucide-react';

export function NoCurrentBorrowingsState() {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 text-center">
      <BookOpenCheck className="mx-auto size-8 text-cyan-700" aria-hidden />
      <h2 className="mt-3 text-base font-semibold text-slate-950">
        No current borrowed books
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Your active borrowing list is clear.
      </p>
    </section>
  );
}

export function QuotaAvailableState({
  remainingAllowance,
}: {
  remainingAllowance: number;
}) {
  if (remainingAllowance <= 0) {
    return null;
  }

  return (
    <section className="rounded-md border border-cyan-200 bg-cyan-50 p-4">
      <div className="flex items-center gap-3">
        <Library className="size-5 shrink-0 text-cyan-800" aria-hidden />
        <p className="text-sm font-medium text-cyan-950">
          {remainingAllowance} books available to borrow
        </p>
      </div>
    </section>
  );
}
