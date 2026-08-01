import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { apiBaseUrl } from '@/lib/api/client';
import { server } from '@/test/mocks/server';
import { StaffDashboard } from './staff-dashboard';

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  );

  return {
    ...actual,
    Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  };
});

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <StaffDashboard />
    </QueryClientProvider>,
  );
}

const books = [
  { id: 'book-1', catalogIdentifier: 'BK-001', title: 'Available', author: 'A', categoryId: 'cat-1', totalQuantity: 2, availableQuantity: 1, status: 'active' },
  { id: 'book-2', catalogIdentifier: 'BK-002', title: 'Unavailable', author: 'B', categoryId: 'cat-1', totalQuantity: 1, availableQuantity: 0, status: 'active' },
  { id: 'book-3', catalogIdentifier: 'BK-003', title: 'Inactive', author: 'C', categoryId: 'cat-1', totalQuantity: 2, availableQuantity: 2, status: 'deactivated' },
  { id: 'book-4', catalogIdentifier: 'BK-004', title: 'Recent four', author: 'D', categoryId: 'cat-1', totalQuantity: 1, availableQuantity: 1, status: 'active' },
  { id: 'book-5', catalogIdentifier: 'BK-005', title: 'Recent five', author: 'E', categoryId: 'cat-1', totalQuantity: 1, availableQuantity: 1, status: 'active' },
  { id: 'book-6', catalogIdentifier: 'BK-006', title: 'Not shown', author: 'F', categoryId: 'cat-1', totalQuantity: 1, availableQuantity: 1, status: 'active' },
];

const members = [
  { id: 'member-1', memberNumber: 'M-001', fullName: 'At limit', membershipTypeId: 'tier-1', status: 'active', activeLoanCount: 3 },
  { id: 'member-2', memberNumber: 'M-002', fullName: 'One loan', membershipTypeId: 'tier-1', status: 'active', activeLoanCount: 1 },
  { id: 'member-3', memberNumber: 'M-003', fullName: 'No loans', membershipTypeId: 'tier-1', status: 'active', activeLoanCount: 0 },
];

const borrowings = Array.from({ length: 6 }, (_, index) => ({
  id: `borrowing-${index + 1}`,
  memberId: `member-${(index % 3) + 1}`,
  memberDisplayName: `Member ${index + 1}`,
  memberNumber: `M-00${index + 1}`,
  bookId: `book-${index + 1}`,
  bookTitle: `Book ${index + 1}`,
  bookCatalogIdentifier: `BK-00${index + 1}`,
  bookCategoryId: 'cat-1',
  borrowedAt: '2026-06-01T00:00:00.000Z',
  dueAt: '2026-06-15T00:00:00.000Z',
  status: 'overdue',
  borrowedByStaffId: 'staff-1',
}));

function useDashboardFixtures(overrides: { books?: Response; members?: Response; borrowings?: Response; overdue?: Response } = {}) {
  server.use(
    http.get(`${apiBaseUrl}/books`, () => overrides.books ?? HttpResponse.json(books)),
    http.get(`${apiBaseUrl}/members`, () => overrides.members ?? HttpResponse.json(members)),
    http.get(`${apiBaseUrl}/borrowings`, () => overrides.borrowings ?? HttpResponse.json(borrowings)),
    http.get(`${apiBaseUrl}/borrowings/overdue`, () => overrides.overdue ?? HttpResponse.json(borrowings)),
  );
}

describe('StaffDashboard', () => {
  it('shows staff summaries, five attention items, and the new borrowing workflow', async () => {
    useDashboardFixtures();
    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Back office dashboard' })).toBeInTheDocument();
    expect(within(screen.getByText('Active borrowings').closest('article')!).getByText('6')).toBeInTheDocument();
    expect(within(screen.getByText('Unavailable books').closest('article')!).getByText('2')).toBeInTheDocument();
    expect(within(screen.getByText('Members at limit').closest('article')!).getByText('1')).toBeInTheDocument();
    expect(screen.getAllByText('Overdue')).toHaveLength(5);
    expect(screen.getByRole('link', { name: 'New borrowing' })).toHaveAttribute('href', '/staff/borrowings/new');
    expect(screen.getByText('Recent books')).toBeInTheDocument();
    expect(screen.queryByText('Not shown')).toBeNull();
  });

  it('shows loading, unavailable, and empty dashboard states', async () => {
    useDashboardFixtures({ books: new Response(null, { status: 500 }) });
    const { unmount } = renderDashboard();
    expect(screen.getByText('Loading dashboard')).toBeInTheDocument();
    expect(await screen.findByText('Dashboard unavailable')).toBeInTheDocument();
    unmount();

    useDashboardFixtures({ books: HttpResponse.json([]), members: HttpResponse.json([]), borrowings: HttpResponse.json([]), overdue: HttpResponse.json([]) });
    renderDashboard();
    expect(await screen.findByText('No overdue borrowings.')).toBeInTheDocument();
    expect(within(screen.getByText('Active borrowings').closest('article')!).getByText('0')).toBeInTheDocument();
  });
});
