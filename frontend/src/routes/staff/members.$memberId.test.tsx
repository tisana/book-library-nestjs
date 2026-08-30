import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { apiBaseUrl } from '@/lib/api/client';
import { server } from '@/test/mocks/server';
import { StaffMemberDetailRoute } from './members.$memberId';

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  );
  return { ...actual, useParams: () => ({ bookId: 'book-1', memberId: 'member-1', borrowingId: 'borrowing-1' }) };
});

const member = {
  id: 'member-1', memberNumber: 'M-001', fullName: 'Member One', membershipTypeId: 'tier-1', status: 'active', activeLoanCount: 2,
};
const policy = {
  memberId: 'member-1', status: 'active', membershipTypeId: 'tier-1', maxActiveLoans: 3,
  activeLoanCount: 2, remainingAllowance: 1, eligibleByStatus: true, withinLimit: true, limitReached: false,
};
const borrowing = {
  id: 'borrowing-1', memberId: 'member-1', bookId: 'book-1', bookCategoryId: 'cat-1',
  borrowedAt: '2026-06-01T00:00:00.000Z', dueAt: '2026-06-15T00:00:00.000Z', status: 'active', borrowedByStaffId: 'staff-1',
};

function renderRoute() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><StaffMemberDetailRoute /></QueryClientProvider>);
}

function useMemberFixtures({ memberResponse = HttpResponse.json(member), policyResponse = HttpResponse.json(policy), borrowingsResponse = HttpResponse.json([borrowing]) }: {
  memberResponse?: Response;
  policyResponse?: Response;
  borrowingsResponse?: Response;
} = {}) {
  server.use(
    http.get(`${apiBaseUrl}/members/member-1`, () => memberResponse),
    http.get(`${apiBaseUrl}/members/member-1/policy-status`, () => policyResponse),
    http.get(`${apiBaseUrl}/members/member-1/borrowings`, () => borrowingsResponse),
  );
}

describe('StaffMemberDetailRoute', () => {
  it('shows a loading state until all member detail data is available', () => {
    server.use(
      http.get(`${apiBaseUrl}/members/member-1`, async () => new Promise<Response>(() => {})),
      http.get(`${apiBaseUrl}/members/member-1/policy-status`, () => HttpResponse.json(policy)),
      http.get(`${apiBaseUrl}/members/member-1/borrowings`, () => HttpResponse.json([])),
    );
    renderRoute();
    expect(screen.getByText('Loading member')).toBeInTheDocument();
  });

  it('shows a not-found state when the member cannot be loaded', async () => {
    useMemberFixtures({ memberResponse: HttpResponse.json({ message: 'not found' }, { status: 404 }) });
    renderRoute();
    expect(await screen.findByText('Member not found')).toBeInTheDocument();
  });

  it('shows missing email and unavailable policy values safely', async () => {
    useMemberFixtures({ policyResponse: HttpResponse.json(null), borrowingsResponse: HttpResponse.json([]) });
    renderRoute();

    expect(await screen.findByText('M-001 · No email recorded')).toBeInTheDocument();
    expect(screen.getAllByText('Unknown')).toHaveLength(2);
  });

  it('shows a reached quota and a borrowing-history error', async () => {
    useMemberFixtures({
      policyResponse: HttpResponse.json({ ...policy, activeLoanCount: 3, remainingAllowance: 0, withinLimit: false, limitReached: true }),
      borrowingsResponse: HttpResponse.json({ message: 'history unavailable' }, { status: 500 }),
    });
    renderRoute();

    expect(await screen.findByText('Member has reached the active borrowing limit.')).toBeInTheDocument();
    expect(screen.getByText('Borrowing history could not be loaded.')).toBeInTheDocument();
  });
});
