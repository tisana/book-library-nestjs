import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffShell } from './staff-shell';

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

  it('renders accessible sign-out controls that route to staff login', async () => {
    const user = userEvent.setup();

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

    expect(navigateMock).toHaveBeenCalledWith({ to: '/staff/login' });
  });
});
