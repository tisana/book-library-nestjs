import { PageHeader } from '@/components/page-header';
import { StaffRoleManagement } from '@/features/auth/staff-role-management';

export function StaffUsersRoute() {
  return (
    <>
      <PageHeader title="Staff access" description="Staff accounts, roles, and account status." />
      <StaffRoleManagement />
    </>
  );
}
