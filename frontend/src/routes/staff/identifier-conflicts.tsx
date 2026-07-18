import { PageHeader } from '@/components/page-header';
import { IdentifierConflicts } from '@/features/auth/identifier-conflicts';

export function IdentifierConflictsRoute() {
  return (
    <>
      <PageHeader title="Identifier conflicts" description="Blocked cross-account sign-in identifiers." />
      <IdentifierConflicts />
    </>
  );
}
