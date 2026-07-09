import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberShell } from './member-shell';
import { apiBaseUrl } from '@/lib/api/client';
import { server } from '@/test/mocks/server';

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
    server.use(
      http.post(`${apiBaseUrl}/auth/logout`, () => HttpResponse.json({})),
    );

    render(
      <MemberShell>
        <p>Member content</p>
      </MemberShell>,
    );

    await user.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({ to: '/member/login' }),
    );
  });
});
