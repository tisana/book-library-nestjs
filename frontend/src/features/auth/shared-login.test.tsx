import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl } from '@/lib/api/client';
import { authSession } from '@/lib/auth/session';
import { server } from '@/test/mocks/server';
import { SharedLogin } from './shared-login';

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

function authResponse(roleArea: 'staff' | 'member', permissions: string[]) {
  const metadata = {
    accessToken: `${roleArea}-token`,
    tokenType: 'Bearer',
    expiresIn: 900,
    scope: permissions.join(' '),
    permissions,
    roleArea,
  };
  return roleArea === 'staff'
    ? {
        ...metadata,
        user: {
          id: 'staff-1',
          email: 'staff@example.com',
          displayName: 'Staff One',
          roles: ['staff'],
          permissions,
        },
      }
    : {
        ...metadata,
        member: {
          id: 'member-1',
          memberNumber: 'M-1001',
          displayName: 'Member One',
          membershipStatus: 'active',
          permissions,
        },
      };
}

describe('SharedLogin', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    authSession.clear('signed-out');
  });

  it.each([
    ['staff@example.com', 'staff', ['catalog:read'], '/staff'],
    ['M-1001', 'member', ['member:self:read'], '/member'],
    ['no-role@example.com', 'staff', [], '/unauthorized'],
  ] as const)(
    'routes %s from authenticated role area and permissions',
    async (identifier, roleArea, permissions, destination) => {
      const user = userEvent.setup();
      server.use(
        http.post(`${apiBaseUrl}/auth/login`, () =>
          HttpResponse.json(authResponse(roleArea, [...permissions])),
        ),
      );
      render(<SharedLogin />);

      await user.type(
        screen.getByLabelText(/email or login identifier/i),
        identifier,
      );
      await user.type(screen.getByLabelText(/password/i), 'Password#2026');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() =>
        expect(navigateMock).toHaveBeenCalledWith({ to: destination }),
      );
    },
  );

  it('is keyboard operable and moves focus to an announced generic error', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${apiBaseUrl}/auth/login`, () =>
        HttpResponse.json(
          { statusCode: 401, message: 'Invalid credentials' },
          { status: 401 },
        ),
      ),
    );
    render(<SharedLogin />);

    await user.type(
      screen.getByLabelText(/email or login identifier/i),
      'unknown',
    );
    await user.tab();
    await user.type(screen.getByLabelText(/password/i), 'wrong-password');
    await user.keyboard('{Enter}');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Invalid credentials');
    await waitFor(() => expect(alert).toHaveFocus());
  });

  it('prevents duplicate submissions while a request is pending', async () => {
    let attempts = 0;
    server.use(
      http.post(`${apiBaseUrl}/auth/login`, async () => {
        attempts += 1;
        await delay(50);
        return HttpResponse.json(authResponse('staff', ['catalog:read']));
      }),
    );
    render(<SharedLogin />);
    fireEvent.change(screen.getByLabelText(/email or login identifier/i), {
      target: { value: 'staff@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'Password#2026' },
    });
    const form = screen
      .getByRole('button', { name: /sign in/i })
      .closest('form');
    fireEvent.submit(form!);
    fireEvent.submit(form!);

    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    expect(attempts).toBe(1);
  });
});
