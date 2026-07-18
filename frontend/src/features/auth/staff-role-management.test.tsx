import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api/client';
import { StaffRoleManagement } from './staff-role-management';

const api = vi.hoisted(() => ({
  useStaffUsers: vi.fn(),
  useRoleReview: vi.fn(),
  useCreateStaffUser: vi.fn(),
  useUpdateStaffUser: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/lib/api/staff-users', () => ({
  useStaffUsers: api.useStaffUsers,
  useRoleReview: api.useRoleReview,
  useCreateStaffUser: api.useCreateStaffUser,
  useUpdateStaffUser: api.useUpdateStaffUser,
}));

describe('StaffRoleManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.useStaffUsers.mockReturnValue({
      data: [
        {
          id: 'staff-1',
          email: 'staff@example.test',
          displayName: 'Staff One',
          roles: ['staff'],
          permissions: ['catalog:read'],
          status: 'active',
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    });
    api.useRoleReview.mockReturnValue({
      data: [
        { role: 'staff', permissions: ['catalog:read'] },
        {
          role: 'admin',
          permissions: ['staff-users:manage', 'roles:manage'],
        },
      ],
      error: null,
    });
    api.create.mockResolvedValue({ id: 'staff-2' });
    api.update.mockResolvedValue({ id: 'staff-1' });
    api.useCreateStaffUser.mockReturnValue({
      mutateAsync: api.create,
      isPending: false,
      isError: false,
    });
    api.useUpdateStaffUser.mockReturnValue({
      mutateAsync: api.update,
      isPending: false,
    });
  });

  it('creates staff and assigns approved roles and status', async () => {
    const user = userEvent.setup();
    render(<StaffRoleManagement />);

    expect(screen.getByText('roles:manage')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Role for Staff One'), 'admin');
    await user.selectOptions(
      screen.getByLabelText('Status for Staff One'),
      'inactive',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(api.update).toHaveBeenCalledWith({
      staffUserId: 'staff-1',
      input: { roles: ['admin'], status: 'inactive' },
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Staff One updated',
    );

    await user.type(screen.getByLabelText('Display name'), 'New Staff');
    await user.type(screen.getByLabelText('Email'), 'new.staff@example.test');
    await user.type(
      screen.getByLabelText('Temporary password'),
      'Temporary#2026',
    );
    await user.selectOptions(screen.getByLabelText('Role'), 'staff');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith({
        email: 'new.staff@example.test',
        displayName: 'New Staff',
        password: 'Temporary#2026',
        roles: ['staff'],
      }),
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Staff account created',
    );
  }, 10_000);

  it('shows a dedicated access-denied state for forbidden staff', () => {
    api.useStaffUsers.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ApiClientError(403, 'Forbidden'),
    });

    render(<StaffRoleManagement />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'You do not have permission to manage staff roles.',
    );
    expect(screen.queryByRole('button', { name: 'Create account' })).toBeNull();
  });
});
