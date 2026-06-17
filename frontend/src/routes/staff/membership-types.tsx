import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { FormField, TextInput } from '@/components/forms';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { useCreateMembershipType, useMembershipTypes } from '@/lib/api/membership-types';
import type { MembershipTierView } from '@/lib/api/types';

export function StaffMembershipTypesRoute() {
  const tiers = useMembershipTypes();
  const createTier = useCreateMembershipType();
  const [form, setForm] = useState({ code: '', name: '', maxActiveLoans: 3 });
  const columns: ColumnDef<MembershipTierView>[] = [
    { accessorKey: 'code', header: 'Code' },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'maxActiveLoans', header: 'Loan limit' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge tone={row.original.status === 'active' ? 'success' : 'neutral'}>
          {row.original.status}
        </StatusBadge>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Membership Types" description="Manage borrowing quota tiers." />
      <section className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <DataTable columns={columns} data={tiers.data ?? []} isLoading={tiers.isLoading} emptyTitle="No membership tiers" />
        <form
          className="flex flex-col gap-4 rounded-md border bg-white p-4"
          onSubmit={async (event) => {
            event.preventDefault();
            await createTier.mutateAsync(form);
            setForm({ code: '', name: '', maxActiveLoans: 3 });
          }}
        >
          <h2 className="font-semibold">Add membership type</h2>
          <FormField htmlFor="tier-code" label="Code">
            <TextInput id="tier-code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required />
          </FormField>
          <FormField htmlFor="tier-name" label="Name">
            <TextInput id="tier-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </FormField>
          <FormField htmlFor="tier-limit" label="Max active loans">
            <TextInput id="tier-limit" type="number" min={0} value={form.maxActiveLoans} onChange={(event) => setForm({ ...form, maxActiveLoans: Number(event.target.value) })} required />
          </FormField>
          <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" type="submit">Save membership type</button>
        </form>
      </section>
    </>
  );
}
