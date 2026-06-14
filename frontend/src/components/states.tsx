import type { ReactNode } from 'react';
import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react';

interface StateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function LoadingState({ title = 'Loading' }: Partial<StateProps>) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-md border bg-white p-6 text-slate-600">
      <LoaderCircle className="mr-2 size-5 animate-spin" aria-hidden />
      <span className="text-sm font-medium">{title}</span>
    </div>
  );
}

export function EmptyState({ title, description, action }: StateProps) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-md border bg-white p-6 text-center">
      <Inbox className="size-8 text-slate-400" aria-hidden />
      <div>
        <p className="font-medium text-slate-950">{title}</p>
        {description ? (
          <p className="mt-1 max-w-md text-sm text-slate-600">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ title, description, action }: StateProps) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-md border border-rose-200 bg-rose-50 p-6 text-center">
      <AlertCircle className="size-8 text-rose-600" aria-hidden />
      <div>
        <p className="font-medium text-rose-950">{title}</p>
        {description ? (
          <p className="mt-1 max-w-md text-sm text-rose-700">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
