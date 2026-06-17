import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { FormField, TextInput } from '@/components/forms';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { useMembers } from '@/lib/api/members';
import type { MemberView } from '@/lib/api/types';

export function StaffMembersRoute() {
  const [q, setQ] = useState('');
  const members = useMembers({ q });
  const columns: ColumnDef<MemberView>[] = [
    {
      accessorKey: 'fullName',
      header: 'Member',
      cell: ({ row }) => (
        <Link
          className="font-medium text-cyan-800 hover:underline"
          params={{ memberId: row.original.id }}
          to="/staff/members/$memberId"
        >
          {row.original.fullName}
        </Link>
      ),
    },
    { accessorKey: 'memberNumber', header: 'Member number' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'activeLoanCount', header: 'Active loans' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge tone={row.original.status === 'active' ? 'success' : 'danger'}>
          {row.original.status}
        </StatusBadge>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Members" description="Find members and inspect borrowing eligibility." />
      <section className="flex flex-col gap-4 p-5 sm:p-6">
        <FormField htmlFor="member-search" label="Search members">
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" aria-hidden />
            <TextInput
              className="pl-9"
              id="member-search"
              onChange={(event) => setQ(event.target.value)}
              placeholder="Name, email, or member number"
              value={q}
            />
          </div>
        </FormField>
        <DataTable
          columns={columns}
          data={members.data ?? []}
          emptyTitle={q ? 'No matching members' : 'No members yet'}
          errorMessage={members.isError ? 'The member list could not be loaded.' : undefined}
          isLoading={members.isLoading}
          state={q ? 'no-results' : 'empty'}
        />
      </section>
    </>
  );
}
