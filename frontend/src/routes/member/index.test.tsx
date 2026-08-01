import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { apiBaseUrl } from '@/lib/api/client';
import { server } from '@/test/mocks/server';
import { MemberHomeRoute } from './index';

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  );

  return {
    ...actual,
    Link: ({ children }: { children: ReactNode }) => (
      <a href="/member/borrowings/borrowing-1">{children}</a>
    ),
  };
});

const profile = {
  id: 'member-1',
  memberNumber: 'M-101',
  displayName: 'Member One',
  membershipStatus: 'active' as const,
  membershipTypeId: 'tier-id',
  membershipTypeCode: 'GOLD',
  membershipTypeName: 'Gold Member',
  activeLoanCount: 1,
};

const policy = {
  memberId: 'member-1',
  status: 'active' as const,
  membershipTypeId: 'tier-id',
  maxActiveLoans: 3,
  activeLoanCount: 1,
  remainingAllowance: 2,
  eligibleByStatus: true,
  withinLimit: true,
  limitReached: false,
};

const overdueBorrowing = {
  id: 'overdue-1',
  memberId: 'member-1',
  bookId: 'book-1',
  bookTitle: 'Overdue Active Book',
  bookCategoryId: 'category-1',
  borrowedAt: '2026-06-01T00:00:00.000Z',
  dueAt: '2026-06-15T00:00:00.000Z',
  status: 'overdue' as const,
  borrowedByStaffId: 'staff-1',
};

const returnedBorrowing = {
  ...overdueBorrowing,
  id: 'returned-1',
  bookTitle: 'Returned Book',
  status: 'returned' as const,
  returnedAt: '2026-06-16T00:00:00.000Z',
};

function renderRoute() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemberHomeRoute />
    </QueryClientProvider>,
  );
}

function useMemberHandlers(overrides: {
  profile?: Response | (() => Response | Promise<Response>);
  policy?: Response | (() => Response | Promise<Response>);
  borrowings?: Response | (() => Response | Promise<Response>);
} = {}) {
  const respond = (
    value: Response | (() => Response | Promise<Response>) | undefined,
    fallback: JsonBodyType,
  ) =>
    typeof value === 'function' ? value() : value ?? HttpResponse.json(fallback);

  server.use(
    http.get(`${apiBaseUrl}/members/me`, () => respond(overrides.profile, profile)),
    http.get(`${apiBaseUrl}/members/me/policy-status`, () =>
      respond(overrides.policy, policy),
    ),
    http.get(`${apiBaseUrl}/members/me/borrowings`, () =>
      respond(overrides.borrowings, []),
    ),
  );
}

describe('MemberHomeRoute', () => {
  it.each(['profile', 'policy', 'borrowings'] as const)(
    'keeps the member status loading while %s is loading',
    (source) => {
      useMemberHandlers({
        [source]: async () => new Promise<Response>(() => {}),
      });

      renderRoute();

      expect(screen.getByText('Loading member status')).toBeInTheDocument();
    },
  );

  it.each(['profile', 'policy', 'borrowings'] as const)(
    'shows one safe status error when %s fails',
    async (source) => {
      useMemberHandlers({
        [source]: HttpResponse.json(
          { message: 'Internal member data' },
          { status: 500 },
        ),
      });

      renderRoute();

      expect(
        await screen.findByText('Member status unavailable'),
      ).toBeInTheDocument();
      expect(screen.queryByText('Internal member data')).toBeNull();
    },
  );

  it.each(['profile', 'policy'] as const)(
    'asks the member to sign in again when %s is missing',
    async (source) => {
      useMemberHandlers({ [source]: HttpResponse.json(null) });

      renderRoute();

      expect(
        await screen.findByText('Member profile unavailable'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Sign in again to refresh your member session.'),
      ).toBeInTheDocument();
    },
  );

  it.each([
    { tier: { membershipTypeName: 'Gold Member' }, label: 'Gold Member' },
    {
      tier: { membershipTypeName: undefined, membershipTypeCode: 'GOLD' },
      label: 'GOLD',
    },
    {
      tier: {
        membershipTypeName: undefined,
        membershipTypeCode: undefined,
      },
      label: 'tier-id',
    },
  ])('uses membership tier precedence for $label', async ({ tier, label }) => {
    useMemberHandlers({ profile: HttpResponse.json({ ...profile, ...tier }) });

    renderRoute();

    expect(await screen.findByRole('heading', { name: 'Member One' })).toBeInTheDocument();
    expect(screen.getByText(`M-101 · ${label}`)).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows allowance and only active overdue books in the current list', async () => {
    useMemberHandlers({
      borrowings: HttpResponse.json([overdueBorrowing, returnedBorrowing]),
    });

    renderRoute();

    expect(
      await screen.findByText('2 books available to borrow'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Overdue Active Book' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Returned Book' })).toBeNull();
  });

  it('shows a suspended badge, no allowance, and the empty current list', async () => {
    useMemberHandlers({
      profile: HttpResponse.json({ ...profile, membershipStatus: 'suspended' }),
      policy: HttpResponse.json({
        ...policy,
        status: 'suspended',
        eligibleByStatus: false,
        remainingAllowance: 0,
        limitReached: false,
      }),
    });

    renderRoute();

    expect(await screen.findByText('Suspended')).toBeInTheDocument();
    expect(
      screen.getByText(/membership is suspended/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/available to borrow/i)).toBeNull();
    expect(screen.getByText('No current borrowed books')).toBeInTheDocument();
  });
});
