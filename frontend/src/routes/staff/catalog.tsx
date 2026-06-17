import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { FormField, TextInput } from '@/components/forms';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { useCatalog, useCreateCatalog } from '@/lib/api/catalog';
import type { CatalogView } from '@/lib/api/types';

export function StaffCatalogRoute() {
  const catalog = useCatalog();
  const createCatalog = useCreateCatalog();
  const [form, setForm] = useState({ code: '', name: '', loanPeriodDays: 14 });
  const columns: ColumnDef<CatalogView>[] = [
    { accessorKey: 'code', header: 'Code' },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'loanPeriodDays', header: 'Loan days' },
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
      <PageHeader title="Catalog Classifications" description="Manage book classifications and loan periods." />
      <section className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <DataTable columns={columns} data={catalog.data ?? []} isLoading={catalog.isLoading} emptyTitle="No catalog classifications" />
        <form
          className="flex flex-col gap-4 rounded-md border bg-white p-4"
          onSubmit={async (event) => {
            event.preventDefault();
            await createCatalog.mutateAsync(form);
            setForm({ code: '', name: '', loanPeriodDays: 14 });
          }}
        >
          <h2 className="font-semibold">Add classification</h2>
          <FormField htmlFor="catalog-code" label="Code">
            <TextInput id="catalog-code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required />
          </FormField>
          <FormField htmlFor="catalog-name" label="Name">
            <TextInput id="catalog-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </FormField>
          <FormField htmlFor="catalog-loan-days" label="Loan period days">
            <TextInput id="catalog-loan-days" type="number" min={1} value={form.loanPeriodDays} onChange={(event) => setForm({ ...form, loanPeriodDays: Number(event.target.value) })} required />
          </FormField>
          <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" type="submit">Save classification</button>
        </form>
      </section>
    </>
  );
}
