import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { LogIn } from 'lucide-react';
import { FormField, TextInput } from '@/components/forms';
import { memberLogin } from '@/lib/api/member-auth';
import { toMutationError } from '@/lib/api/errors';

export function MemberLogin() {
  const navigate = useNavigate();
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [isSubmitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSubmitting(true);

    try {
      await memberLogin({ loginIdentifier, password });
      await navigate({ to: '/member' });
    } catch (caught) {
      setError(toMutationError(caught).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <FormField htmlFor="member-login-identifier" label="Login identifier">
        <TextInput
          autoComplete="username"
          id="member-login-identifier"
          onChange={(event) => setLoginIdentifier(event.target.value)}
          value={loginIdentifier}
        />
      </FormField>
      <FormField htmlFor="member-password" label="Password">
        <TextInput
          autoComplete="current-password"
          id="member-password"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
      </FormField>
      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white disabled:bg-slate-400"
        disabled={isSubmitting}
        type="submit"
      >
        <LogIn className="size-4" aria-hidden />
        Sign in
      </button>
    </form>
  );
}
