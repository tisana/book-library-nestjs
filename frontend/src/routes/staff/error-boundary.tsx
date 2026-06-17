import { Link } from '@tanstack/react-router';
import { ErrorState } from '@/components/states';

export function StaffRouteErrorBoundary({ error }: { error?: unknown }) {
  const message =
    error instanceof Error ? error.message : 'This staff route could not load.';

  return (
    <div className="p-5 sm:p-6">
      <ErrorState
        title="Staff workspace unavailable"
        description={message}
        action={
          <Link
            className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white"
            to="/staff"
          >
            Back to dashboard
          </Link>
        }
      />
    </div>
  );
}
