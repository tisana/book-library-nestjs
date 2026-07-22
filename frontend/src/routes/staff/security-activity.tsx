import { PageHeader } from '@/components/page-header';
import { SecurityActivity } from '@/features/auth/security-activity';

export function SecurityActivityRoute() {
  return (
    <>
      <PageHeader
        description="Authentication, access, role, account, and session events."
        title="Security activity"
      />
      <SecurityActivity />
    </>
  );
}
