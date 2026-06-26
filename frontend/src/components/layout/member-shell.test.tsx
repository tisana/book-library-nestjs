import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberShell } from './member-shell';

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => navigateMock,
}));

describe('MemberShell', () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it('renders an accessible sign-out control that routes to member login', async () => {
    const user = userEvent.setup();

    render(
      <MemberShell>
        <p>Member content</p>
      </MemberShell>,
    );

    await user.click(screen.getByRole('button', { name: /sign out/i }));

    expect(navigateMock).toHaveBeenCalledWith({ to: '/member/login' });
  });
});
