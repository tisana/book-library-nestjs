import { StatusBadge } from '@/components/status-badge';
import type { MemberPolicyStatusView } from '@/lib/api/types';

interface QuotaStatusCardProps {
  policy: MemberPolicyStatusView;
}

export function QuotaStatusCard({ policy }: QuotaStatusCardProps) {
  const usedLabel = `${policy.activeLoanCount} of ${policy.maxActiveLoans} borrowed`;
  const remainingLabel = policy.limitReached
    ? 'Limit reached'
    : `${policy.remainingAllowance} remaining`;
  const percentage =
    policy.maxActiveLoans > 0
      ? Math.min((policy.activeLoanCount / policy.maxActiveLoans) * 100, 100)
      : 0;

  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">
            Borrowing quota
          </h2>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">
            {usedLabel}
          </p>
        </div>
        <StatusBadge tone={policy.limitReached ? 'warning' : 'success'}>
          {remainingLabel}
        </StatusBadge>
      </div>
      <div
        aria-label={usedLabel}
        className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"
        role="meter"
        aria-valuemax={policy.maxActiveLoans}
        aria-valuemin={0}
        aria-valuenow={policy.activeLoanCount}
      >
        <div
          className="h-full rounded-full bg-cyan-700"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {!policy.eligibleByStatus ? (
        <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          This account cannot borrow new books while its membership is{' '}
          {policy.status}.
        </p>
      ) : policy.limitReached ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Return a current book before borrowing another title.
        </p>
      ) : null}
    </article>
  );
}
