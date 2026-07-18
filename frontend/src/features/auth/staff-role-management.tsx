import { useState } from 'react';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { FormField, TextInput } from '@/components/forms';
import { StatusBadge } from '@/components/status-badge';
import { ApiClientError } from '@/lib/api/client';
import {
  useCreateStaffUser,
  useRoleReview,
  useStaffUsers,
  useUpdateStaffUser,
} from '@/lib/api/staff-users';
import type {
  StaffRole,
  StaffUserStatus,
  StaffUserView,
} from '@/lib/api/types';

const roleLabels: Record<StaffRole, string> = {
  staff: 'Staff',
  admin: 'Administrator',
};

export function StaffRoleManagement() {
  const staffUsers = useStaffUsers();
  const roleReview = useRoleReview();
  const createUser = useCreateStaffUser();
  const updateUser = useUpdateStaffUser();
  const [notice, setNotice] = useState<string>();
  const [form, setForm] = useState({
    email: '',
    displayName: '',
    password: '',
    role: 'staff' as StaffRole,
  });

  if (isForbidden(staffUsers.error) || isForbidden(roleReview.error)) {
    return <AccessDenied />;
  }

  return (
    <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_22rem] sm:p-6">
      <section className="min-w-0">
        {notice ? (
          <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
            {notice}
          </p>
        ) : null}
        {staffUsers.isError ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
            Staff accounts could not be loaded.
          </p>
        ) : (
          <div className="overflow-x-auto border bg-white">
            <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
              <thead className="border-b bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Account</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(staffUsers.data ?? []).map((staffUser) => (
                  <StaffUserRow
                    key={staffUser.id}
                    staffUser={staffUser}
                    saving={updateUser.isPending}
                    onSave={async (roles, status) => {
                      await updateUser.mutateAsync({
                        staffUserId: staffUser.id,
                        input: { roles, status },
                      });
                      setNotice(`${staffUser.displayName} updated`);
                    }}
                  />
                ))}
              </tbody>
            </table>
            {!staffUsers.isLoading && !staffUsers.data?.length ? (
              <p className="p-5 text-sm text-slate-600">No staff accounts.</p>
            ) : null}
          </div>
        )}
        <section className="mt-6 border-t pt-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="size-4" aria-hidden />
            Role permissions
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {(roleReview.data ?? []).map((review) => (
              <div className="border-l-4 border-cyan-700 bg-white px-4 py-3" key={review.role}>
                <h3 className="font-medium">{roleLabels[review.role]}</h3>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {review.permissions.map((permission) => (
                    <li key={permission}>{permission}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </section>

      <form
        className="flex h-fit flex-col gap-4 border bg-white p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await createUser.mutateAsync({
              email: form.email,
              displayName: form.displayName,
              password: form.password,
              roles: [form.role],
            });
            setForm({ email: '', displayName: '', password: '', role: 'staff' });
            setNotice('Staff account created');
          } catch {
            // Mutation error is rendered below without exposing submitted secrets.
          }
        }}
      >
        <h2 className="flex items-center gap-2 font-semibold">
          <UserPlus className="size-4" aria-hidden />
          Add staff account
        </h2>
        <FormField htmlFor="staff-display-name" label="Display name">
          <TextInput
            id="staff-display-name"
            value={form.displayName}
            onChange={(event) =>
              setForm({ ...form, displayName: event.target.value })
            }
            required
          />
        </FormField>
        <FormField htmlFor="staff-email" label="Email">
          <TextInput
            id="staff-email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
        </FormField>
        <FormField htmlFor="staff-password" label="Temporary password">
          <TextInput
            id="staff-password"
            type="password"
            minLength={12}
            value={form.password}
            onChange={(event) =>
              setForm({ ...form, password: event.target.value })
            }
            required
          />
        </FormField>
        <FormField htmlFor="staff-role" label="Role">
          <select
            className="h-10 rounded-md border bg-white px-3 text-sm"
            id="staff-role"
            value={form.role}
            onChange={(event) =>
              setForm({ ...form, role: event.target.value as StaffRole })
            }
          >
            <option value="staff">Staff</option>
            <option value="admin">Administrator</option>
          </select>
        </FormField>
        {createUser.isError ? (
          <p className="text-sm text-rose-700" role="alert">
            Staff account could not be created.
          </p>
        ) : null}
        <button
          className="min-h-10 rounded-md bg-slate-950 px-4 text-sm font-medium text-white disabled:bg-slate-400"
          disabled={createUser.isPending}
          type="submit"
        >
          {createUser.isPending ? 'Creating...' : 'Create account'}
        </button>
      </form>
    </div>
  );
}

function StaffUserRow({
  staffUser,
  saving,
  onSave,
}: {
  staffUser: StaffUserView;
  saving: boolean;
  onSave: (roles: StaffRole[], status: StaffUserStatus) => Promise<void>;
}) {
  const [role, setRole] = useState<StaffRole>(staffUser.roles[0] ?? 'staff');
  const [status, setStatus] = useState<StaffUserStatus>(staffUser.status);

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-3">
        <p className="font-medium">{staffUser.displayName}</p>
        <p className="text-xs text-slate-500">{staffUser.email}</p>
      </td>
      <td className="px-4 py-3">
        <select
          aria-label={`Role for ${staffUser.displayName}`}
          className="h-9 rounded-md border bg-white px-2"
          value={role}
          onChange={(event) => setRole(event.target.value as StaffRole)}
        >
          <option value="staff">Staff</option>
          <option value="admin">Administrator</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <StatusBadge tone={status === 'active' ? 'success' : 'danger'}>
          {status}
        </StatusBadge>
        <select
          aria-label={`Status for ${staffUser.displayName}`}
          className="ml-2 h-9 rounded-md border bg-white px-2"
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as StaffUserStatus)
          }
        >
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <button
          className="min-h-9 rounded-md border px-3 font-medium hover:bg-slate-50 disabled:text-slate-400"
          disabled={saving}
          onClick={() => void onSave([role], status)}
          type="button"
        >
          Save
        </button>
      </td>
    </tr>
  );
}

function AccessDenied() {
  return (
    <p className="m-5 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
      You do not have permission to manage staff roles.
    </p>
  );
}

function isForbidden(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 403;
}
