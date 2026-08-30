import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl } from '@/lib/api/client';
import { authSession } from '@/lib/auth/session';
import { server } from '@/test/mocks/server';
import {
  LoginRoute,
  MemberLoginPlaceholderRoute,
  PublicHome,
  StaffLoginRoute,
  UnauthorizedRoute,
} from './public';

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', async () => ({
  ...(await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  )),
  useNavigate: () => navigateMock,
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  Navigate: (props: { replace: boolean; to: string }) => (
    <output data-replace={String(props.replace)}>{props.to}</output>
  ),
}));

const memberAuthResponse = {
  accessToken: 'member-access-token',
  tokenType: 'Bearer' as const,
  expiresIn: 900,
  scope: 'member:self:read',
  permissions: ['member:self:read'],
  issuer: 'book-library',
  audience: 'book-library-web',
  authVersion: 4,
  roleArea: 'member' as const,
  member: {
    id: 'member-1',
    memberNumber: 'M-1001',
    displayName: 'Member One',
    email: 'member@example.com',
    membershipStatus: 'active' as const,
    roleArea: 'member' as const,
    permissions: ['member:self:read'],
  },
};

describe('public routes', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    authSession.clear('signed-out');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('offers only shared sign-in and member-home destinations publicly', () => {
    render(<PublicHome />);

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(screen.getByRole('link', { name: 'Member home' })).toHaveAttribute(
      'href',
      '/member',
    );
  });

  it('shows a safe unauthorized state with a shared-login recovery link', () => {
    render(<UnauthorizedRoute />);

    expect(
      screen.getByRole('heading', { name: 'Access unavailable' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return to sign in' })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('redirects both compatibility routes to the shared login with replacement', () => {
    const { rerender } = render(<StaffLoginRoute />);

    expect(screen.getByText('/login')).toHaveAttribute('data-replace', 'true');

    rerender(<MemberLoginPlaceholderRoute />);
    expect(screen.getByText('/login')).toHaveAttribute('data-replace', 'true');
  });

  it('routes a member from the server-returned role area', async () => {
    let submitted: unknown;
    server.use(
      http.post(`${apiBaseUrl}/auth/login`, async ({ request }) => {
        submitted = await request.json();
        expect(request.headers.get('authorization')).toBeNull();
        return HttpResponse.json(memberAuthResponse);
      }),
    );
    render(<LoginRoute />);
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText(/email or login identifier/i),
      'M-1001',
    );
    await user.type(screen.getByLabelText(/password/i), 'Password#2026');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({ to: '/member' }),
    );
    expect(submitted).toEqual({
      identifier: 'M-1001',
      password: 'Password#2026',
    });
    expect(authSession.getSnapshot()).toMatchObject({
      accessToken: 'member-access-token',
      roleArea: 'member',
      permissions: ['member:self:read'],
    });
  });
});
