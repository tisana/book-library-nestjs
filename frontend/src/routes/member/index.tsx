import { PageHeader } from '@/components/page-header';
import { ErrorState, LoadingState } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { BorrowedBooksList } from '@/features/member-home/borrowed-books-list';
import {
  NoCurrentBorrowingsState,
  QuotaAvailableState,
} from '@/features/member-home/member-empty-states';
import { QuotaStatusCard } from '@/features/member-home/quota-status-card';
import {
  useMyBorrowings,
  useMyPolicyStatus,
  useMyProfile,
} from '@/lib/api/member-self-service';

export function MemberHomeRoute() {
  const profile = useMyProfile();
  const policy = useMyPolicyStatus();
  const borrowings = useMyBorrowings({ currentOnly: true, limit: 10 });

  if (profile.isLoading || policy.isLoading || borrowings.isLoading) {
    return <LoadingState title="Loading member status" />;
  }

  if (profile.isError || policy.isError || borrowings.isError) {
    return (
      <ErrorState
        description="Your membership and borrowing status could not be loaded."
        title="Member status unavailable"
      />
    );
  }

  if (!profile.data || !policy.data) {
    return (
      <ErrorState
        description="Sign in again to refresh your member session."
        title="Member profile unavailable"
      />
    );
  }

  const activeBorrowings = borrowings.data ?? [];
  const tierName =
    profile.data.membershipTypeName ??
    profile.data.membershipTypeCode ??
    profile.data.membershipTypeId;

  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        description={`${profile.data.memberNumber} · ${tierName}`}
        title={profile.data.displayName}
        actions={
          <StatusBadge
            tone={
              profile.data.membershipStatus === 'active' ? 'success' : 'danger'
            }
          >
            {toTitle(profile.data.membershipStatus)}
          </StatusBadge>
        }
      />
      <QuotaStatusCard policy={policy.data} />
      <QuotaAvailableState
        remainingAllowance={policy.data.remainingAllowance}
      />
      {activeBorrowings.length > 0 ? (
        <BorrowedBooksList borrowings={activeBorrowings} />
      ) : (
        <NoCurrentBorrowingsState />
      )}
    </section>
  );
}

function toTitle(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
