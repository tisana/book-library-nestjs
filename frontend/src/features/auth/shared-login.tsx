/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { LogIn } from 'lucide-react';
import { FormField, TextInput } from '@/components/forms';
import { login } from '@/lib/api/auth';
import { toMutationError } from '@/lib/api/errors';
import type { SessionUser } from '@/lib/api/types';

export type AuthLandingRoute = '/staff' | '/member' | '/unauthorized';

export function landingRouteFor(user: SessionUser): AuthLandingRoute {
  if (user.roleArea === 'member') {
    return user.permissions.includes('member:self:read')
      ? '/member'
      : '/unauthorized';
  }

  return user.permissions.length > 0 ? '/staff' : '/unauthorized';
}

export function SharedLogin() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [isSubmitting, setSubmitting] = useState(false);
  const submissionPending = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionPending.current) return;

    submissionPending.current = true;
    setError(undefined);
    setSubmitting(true);

    try {
      const user = await login({ identifier, password });
      await navigate({ to: landingRouteFor(user) });
    } catch (caught) {
      setError(toMutationError(caught).message);
    } finally {
      submissionPending.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <FormField htmlFor="login-identifier" label="Email or member number">
        <TextInput
          aria-label="Email or login identifier"
          autoComplete="username"
          autoFocus
          id="login-identifier"
          onChange={(event) => setIdentifier(event.target.value)}
          value={identifier}
        />
      </FormField>
      <FormField htmlFor="login-password" label="Password">
        <TextInput
          autoComplete="current-password"
          id="login-password"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
      </FormField>
      {error ? (
        <p
          aria-live="assertive"
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 outline-none"
          ref={errorRef}
          role="alert"
          tabIndex={-1}
        >
          {error}
        </p>
      ) : null}
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white disabled:bg-slate-400"
        disabled={isSubmitting}
        type="submit"
      >
        <LogIn aria-hidden className="size-4" />
        {isSubmitting ? 'Signing in' : 'Sign in'}
      </button>
    </form>
  );
}
