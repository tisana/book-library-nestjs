import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffShell } from './staff-shell';
import { apiBaseUrl } from '@/lib/api/client';
import { server } from '@/test/mocks/server';

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => navigateMock,
}));

describe('StaffShell', () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it('renders accessible sign-out controls that route to shared login', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${apiBaseUrl}/auth/logout`, () => HttpResponse.json({})),
    );

    render(
      <StaffShell>
        <p>Staff content</p>
      </StaffShell>,
    );

    const signOutButtons = screen.getAllByRole('button', {
      name: /sign out/i,
    });

    expect(signOutButtons.length).toBeGreaterThan(0);
    await user.click(signOutButtons[0]);

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({ to: '/login' }),
    );
  });
});
