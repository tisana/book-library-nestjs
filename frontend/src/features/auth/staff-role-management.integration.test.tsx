import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { delay, http, HttpResponse } from 'msw';
import { apiBaseUrl } from '@/lib/api/client';
import { server } from '@/test/mocks/server';
import { StaffRoleManagement } from './staff-role-management';

function renderManagement() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><StaffRoleManagement /></QueryClientProvider>);
}

const roles = [
  { role: 'staff', permissions: ['catalog:read'] },
  { role: 'admin', permissions: ['staff-users:manage', 'roles:manage'] },
];

describe('StaffRoleManagement MSW integration', () => {
  it('renders a visible loading state before empty and forbidden responses through real hooks', async () => {
    server.use(
      http.get(`${apiBaseUrl}/staff-users`, async () => { await delay(20); return HttpResponse.json([]); }),
      http.get(`${apiBaseUrl}/auth/roles`, () => HttpResponse.json(roles)),
    );
    renderManagement();
    expect(screen.getByRole('status')).toHaveTextContent('Loading staff accounts');
    expect(screen.queryByRole('table')).toBeNull();
    expect(await screen.findByText('No staff accounts.')).toBeInTheDocument();

    server.use(http.get(`${apiBaseUrl}/staff-users`, () => HttpResponse.json({}, { status: 403 })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><StaffRoleManagement /></QueryClientProvider>);
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to manage staff roles.');
  });

  it('redacts generic server failures through real hooks', async () => {
    server.use(
      http.get(`${apiBaseUrl}/staff-users`, () =>
        HttpResponse.json({ message: 'database hostname must stay private' }, { status: 500 }),
      ),
      http.get(`${apiBaseUrl}/auth/roles`, () => HttpResponse.json(roles)),
    );
    renderManagement();

    expect(await screen.findByRole('alert')).toHaveTextContent('Staff accounts could not be loaded.');
    expect(screen.queryByText(/database hostname/i)).toBeNull();
  });

  it('refetches real staff data after a successful role update', async () => {
    const user = userEvent.setup();
    let refreshed = false;
    server.use(
      http.get(`${apiBaseUrl}/auth/roles`, () => HttpResponse.json(roles)),
      http.get(`${apiBaseUrl}/staff-users`, () => HttpResponse.json([{
        id: 'staff-1', email: 'staff@example.test', displayName: refreshed ? 'Refreshed Staff' : 'Staff One',
        roles: ['staff'], permissions: ['catalog:read'], status: 'active',
      }])),
      http.patch(`${apiBaseUrl}/staff-users/staff-1`, () => { refreshed = true; return HttpResponse.json({}); }),
    );
    renderManagement();
    await user.selectOptions(await screen.findByLabelText('Role for Staff One'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Refreshed Staff')).toBeInTheDocument();
  });
});
