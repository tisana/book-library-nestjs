import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { LogIn } from 'lucide-react';
import { FormField, TextInput } from '@/components/forms';
import { staffLogin } from '@/lib/api/auth';
import { toMutationError } from '@/lib/api/errors';

export function StaffLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [isSubmitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSubmitting(true);

    try {
      await staffLogin({ email, password });
      await navigate({ to: '/staff' });
    } catch (caught) {
      setError(toMutationError(caught).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <FormField htmlFor="staff-email" label="Email">
        <TextInput
          autoComplete="email"
          id="staff-email"
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          value={email}
        />
      </FormField>
      <FormField htmlFor="staff-password" label="Password">
        <TextInput
          autoComplete="current-password"
          id="staff-password"
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
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white disabled:bg-slate-400"
        disabled={isSubmitting}
        type="submit"
      >
        <LogIn className="size-4" aria-hidden />
        Sign in
      </button>
    </form>
  );
}
