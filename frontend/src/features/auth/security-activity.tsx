import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { FormField } from '@/components/forms';
import { ApiClientError } from '@/lib/api/client';
import { useSecurityActivity } from '@/lib/api/auth';
import type {
  SecurityActivityEventType,
  SecurityActivityEventView,
  SecurityActivityOutcome,
} from '@/lib/api/types';

const eventTypes: SecurityActivityEventType[] = [
  'sign-in-success',
  'sign-in-failure',
  'authorization-denied',
  'role-changed',
  'account-status-changed',
  'identifier-conflict-detected',
  'identifier-conflict-resolved',
  'identifier-reservation-recovered',
  'identifier-repair-resumed',
  'token-refreshed',
  'refresh-replay-detected',
  'token-revoked',
  'sign-out',
];

const outcomes: SecurityActivityOutcome[] = ['success', 'failure', 'denied'];

export function SecurityActivity() {
  const [eventType, setEventType] = useState<SecurityActivityEventType | ''>('');
  const [outcome, setOutcome] = useState<SecurityActivityOutcome | ''>('');
  const [page, setPage] = useState(1);
  const query = useSecurityActivity({
    ...(eventType ? { eventType } : {}),
    ...(outcome ? { outcome } : {}),
    page,
    limit: 50,
  });
  const columns: ColumnDef<SecurityActivityEventView>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Time',
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
    },
    { accessorKey: 'eventType', header: 'Event' },
    {
      header: 'Actor or correlation',
      cell: ({ row }) => {
        const event = row.original;
        if (event.actorId) return event.actorId;
        if (event.correlationKeyVersion) {
          return `Correlation v${event.correlationKeyVersion}`;
        }
        return event.actorType;
      },
    },
    {
      header: 'Action',
      cell: ({ row }) =>
        [row.original.targetType, row.original.targetId]
          .filter(Boolean)
          .join(' / ') || 'Not applicable',
    },
    { accessorKey: 'outcome', header: 'Outcome' },
    {
      accessorKey: 'reasonCategory',
      header: 'Reason',
      cell: ({ row }) => row.original.reasonCategory ?? 'Not specified',
    },
  ];

  if (query.error instanceof ApiClientError && query.error.status === 403) {
    return (
      <p
        className="m-5 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        role="alert"
      >
        You do not have permission to review security activity.
      </p>
    );
  }

  return (
    <div className="space-y-4 p-5 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <FormField htmlFor="security-event-type" label="Event type">
          <select
            className="h-10 rounded-md border bg-white px-3 text-sm"
            id="security-event-type"
            value={eventType}
            onChange={(event) => {
              setEventType(event.target.value as SecurityActivityEventType | '');
              setPage(1);
            }}
          >
            <option value="">All event types</option>
            {eventTypes.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </FormField>
        <FormField htmlFor="security-outcome" label="Outcome">
          <select
            className="h-10 rounded-md border bg-white px-3 text-sm"
            id="security-outcome"
            value={outcome}
            onChange={(event) => {
              setOutcome(event.target.value as SecurityActivityOutcome | '');
              setPage(1);
            }}
          >
            <option value="">All outcomes</option>
            {outcomes.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </FormField>
      </div>
      <DataTable
        columns={columns}
        data={query.data?.items ?? []}
        emptyDescription="Security events will appear here as protected activity occurs."
        emptyTitle="No security activity found"
        errorMessage={query.isError ? 'Security activity could not be loaded.' : undefined}
        isLoading={query.isLoading}
      />
      {query.data && query.data.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Page {query.data.page} of {query.data.totalPages}</span>
          <div className="flex gap-2">
            <button
              className="rounded-md border bg-white px-3 py-2 disabled:text-slate-400"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              type="button"
            >
              Previous
            </button>
            <button
              className="rounded-md border bg-white px-3 py-2 disabled:text-slate-400"
              disabled={page >= query.data.totalPages}
              onClick={() => setPage((value) => value + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
