import { Link, Navigate } from '@tanstack/react-router';
import { PageHeader } from '@/components/page-header';
import { SharedLogin } from '@/features/auth/shared-login';

export function PublicHome() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-6 px-6 py-12">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-normal text-cyan-700">
            Book Library
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal">
            Library operations and member borrowing status
          </h1>
          <p className="mt-4 text-base text-slate-600">
            Staff use the back office on larger screens. Members use a
            mobile-first account view for current loans, due dates, and quota.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white"
            to="/login"
          >
            Sign in
          </Link>
          <Link
            className="rounded-md border bg-white px-4 py-2 text-sm font-medium text-slate-700"
            to="/member"
          >
            Member home
          </Link>
        </div>
      </section>
    </main>
  );
}

export function LoginRoute() {
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-5">
        <section className="w-full rounded-md border bg-white p-5 shadow-sm">
          <PageHeader
            description="Use your staff email, member email, or member number."
            title="Sign in to Book Library"
          />
          <div className="p-5">
            <SharedLogin />
          </div>
        </section>
      </div>
    </main>
  );
}

export function UnauthorizedRoute() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5">
      <section className="max-w-md rounded-md border bg-white p-6 text-center">
        <h1 className="text-xl font-semibold text-slate-950">
          Access unavailable
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          The active session does not have access to that workspace.
        </p>
        <Link
          className="mt-5 inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white"
          to="/login"
        >
          Return to sign in
        </Link>
      </section>
    </main>
  );
}

export function StaffLoginRoute() {
  return <Navigate replace to="/login" />;
}

export function MemberLoginPlaceholderRoute() {
  return <Navigate replace to="/login" />;
}
