import { useMemo, useState } from 'react';
import { Fingerprint, Wrench } from 'lucide-react';
import { FormField, TextInput } from '@/components/forms';
import { StatusBadge } from '@/components/status-badge';
import {
  useIdentifierConflicts,
  useIdentifierOperation,
  useResolveIdentifierConflict,
} from '@/lib/api/auth';
import { ApiClientError } from '@/lib/api/client';
import type {
  AuthIdentifierConflictView,
  AuthIdentifierSubjectView,
} from '@/lib/api/types';

export function IdentifierConflicts() {
  const conflicts = useIdentifierConflicts();
  const resolveConflict = useResolveIdentifierConflict();
  const [operationId, setOperationId] = useState<string>();
  const operation = useIdentifierOperation(operationId);

  if (isForbidden(conflicts.error)) {
    return (
      <p className="m-5 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
        You do not have permission to review identifier conflicts.
      </p>
    );
  }

  return (
    <div className="space-y-5 p-5 sm:p-6">
      {operation.data ? (
        <p className="rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900" role="status">
          Resolution {operation.data.status}
        </p>
      ) : null}
      {conflicts.isError ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          Identifier conflicts could not be loaded.
        </p>
      ) : null}
      {(conflicts.data ?? []).map((conflict) => (
        <ConflictPanel
          conflict={conflict}
          key={conflict.id}
          saving={resolveConflict.isPending}
          onResolve={async (input) => {
            const result = await resolveConflict.mutateAsync({
              conflictId: conflict.id,
              input,
            });
            setOperationId(result.operationId);
          }}
        />
      ))}
      {!conflicts.isLoading && !conflicts.data?.length ? (
        <p className="border bg-white p-5 text-sm text-slate-600">
          No identifier conflicts require review.
        </p>
      ) : null}
    </div>
  );
}

function ConflictPanel({
  conflict,
  saving,
  onResolve,
}: {
  conflict: AuthIdentifierConflictView;
  saving: boolean;
  onResolve: (
    input: Parameters<ReturnType<typeof useResolveIdentifierConflict>['mutateAsync']>[0]['input'],
  ) => Promise<void>;
}) {
  const [retainedKey, setRetainedKey] = useState('');
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const subjectMap = useMemo(
    () => new Map(conflict.subjects.map((subject) => [subjectKey(subject), subject])),
    [conflict.subjects],
  );

  if (conflict.resolutionStatus === 'manual-repair-required') {
    return (
      <section className="border-l-4 border-amber-500 bg-white p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Wrench className="size-4" aria-hidden />
          Manual repair required
        </h2>
        <p className="mt-2 font-mono text-sm">{conflict.normalizedIdentifier}</p>
        <p className="mt-2 text-sm text-slate-600">
          {conflict.subjects.length} account claims remain blocked.
        </p>
      </section>
    );
  }

  return (
    <form
      className="border bg-white p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(undefined);
        const reassignments = conflict.subjects
          .filter((subject) => subjectKey(subject) !== retainedKey)
          .map((subject) => ({
            subjectType: subject.subjectType,
            subjectId: subject.subjectId,
            newIdentifier: replacements[subjectKey(subject)]?.trim() ?? '',
          }));
        if (reassignments.some((item) => !item.newIdentifier)) {
          setError('Every reassigned account needs a replacement identifier.');
          return;
        }
        if (
          new Set(reassignments.map((item) => item.newIdentifier.toLowerCase())).size !==
          reassignments.length
        ) {
          setError('Replacement identifiers must be unique.');
          return;
        }
        try {
          await onResolve({
            operationId: createOperationId(),
            retainedSubject: retainedKey
              ? (() => {
                  const retained = subjectMap.get(retainedKey)!;
                  return {
                    subjectType: retained.subjectType,
                    subjectId: retained.subjectId,
                  };
                })()
              : undefined,
            reassignments,
          });
        } catch {
          setError('Identifier conflict could not be resolved.');
        }
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Fingerprint className="size-4" aria-hidden />
          {conflict.normalizedIdentifier}
        </h2>
        <StatusBadge tone="danger">Conflict</StatusBadge>
      </div>
      <FormField htmlFor={`retained-${conflict.id}`} label="Account retaining current identifier">
        <select
          className="h-10 w-full max-w-xl rounded-md border bg-white px-3 text-sm"
          id={`retained-${conflict.id}`}
          value={retainedKey}
          onChange={(event) => setRetainedKey(event.target.value)}
        >
          <option value="">No account</option>
          {conflict.subjects.map((subject) => (
            <option key={subjectKey(subject)} value={subjectKey(subject)}>
              {subject.displayLabel} ({subject.subjectType})
            </option>
          ))}
        </select>
      </FormField>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {conflict.subjects
          .filter((subject) => subjectKey(subject) !== retainedKey)
          .map((subject) => (
            <FormField
              htmlFor={`replacement-${conflict.id}-${subject.subjectId}`}
              key={subjectKey(subject)}
              label={`Replacement for ${subject.displayLabel}`}
            >
              <TextInput
                id={`replacement-${conflict.id}-${subject.subjectId}`}
                value={replacements[subjectKey(subject)] ?? ''}
                onChange={(event) =>
                  setReplacements({
                    ...replacements,
                    [subjectKey(subject)]: event.target.value,
                  })
                }
                required
              />
            </FormField>
          ))}
      </div>
      {error ? (
        <p className="mt-4 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="mt-4 min-h-10 rounded-md bg-slate-950 px-4 text-sm font-medium text-white disabled:bg-slate-400"
        disabled={saving}
        type="submit"
      >
        {saving ? 'Resolving...' : 'Resolve conflict'}
      </button>
    </form>
  );
}

function subjectKey(subject: AuthIdentifierSubjectView): string {
  return `${subject.subjectType}:${subject.subjectId}`;
}

function createOperationId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `operation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isForbidden(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 403;
}
