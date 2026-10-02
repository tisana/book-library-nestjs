import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api/client';
import { SecurityActivity } from './security-activity';

const api = vi.hoisted(() => ({ useSecurityActivity: vi.fn() }));

vi.mock('@/lib/api/auth', () => ({
  useSecurityActivity: api.useSecurityActivity,
}));

describe('SecurityActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.useSecurityActivity.mockReturnValue({
      data: {
        items: [
          {
            id: 'event-1',
            eventType: 'authorization-denied',
            actorType: 'member',
            actorId: 'member-opaque-id',
            actorName: 'Morgan Reader',
            targetType: 'BooksController',
            targetId: 'create',
            outcome: 'denied',
            reasonCategory: 'staff-permission-required',
            createdAt: '2026-07-18T01:00:00.000Z',
          },
          {
            id: 'event-2',
            eventType: 'sign-in-failure',
            actorType: 'unknown',
            outcome: 'failure',
            identifierCorrelationHash: 'opaque-correlation',
            correlationKeyVersion: 7,
            createdAt: '2026-07-18T00:30:00.000Z',
          },
        ],
        page: 1,
        limit: 50,
        total: 2,
        totalPages: 1,
      },
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it('renders safe event context and applies event and outcome filters', async () => {
    const user = userEvent.setup();
    render(<SecurityActivity />);

    expect(screen.getAllByText('authorization-denied')).toHaveLength(2);
    expect(screen.getByText('Morgan Reader')).toBeInTheDocument();
    expect(screen.getByTitle('User ID: member-opaque-id')).toBeInTheDocument();
    expect(screen.getByText('Unknown user')).toBeInTheDocument();
    expect(screen.getByTitle('Correlation v7: opaque-correlation')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/password|reader@example/i);

    await user.selectOptions(
      screen.getByLabelText('Event type'),
      'sign-in-failure',
    );
    await user.selectOptions(screen.getByLabelText('Outcome'), 'failure');
    expect(api.useSecurityActivity).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: 'sign-in-failure',
        outcome: 'failure',
        limit: 50,
      }),
    );
  });

  it.each([
    ['staff', 'deleted-staff-id', 'Staff account unavailable'],
    ['member', 'deleted-member-id', 'Member account unavailable'],
    ['system', undefined, 'System'],
    ['unknown', undefined, 'Unknown user'],
  ])('labels %s events when no account name is available', (actorType, actorId, label) => {
    const result = api.useSecurityActivity();
    result.data.items = [{
      id: 'fallback-event',
      eventType: 'sign-in-failure',
      actorType,
      actorId,
      outcome: 'failure',
      createdAt: '2026-07-18T01:00:00.000Z',
    }];
    render(<SecurityActivity />);
    expect(screen.getByText(label)).toBeInTheDocument();
    if (actorId) {
      expect(screen.getByTitle(`User ID: ${actorId}`)).toBeInTheDocument();
    }
  });

  it('shows a clear forbidden state', () => {
    api.useSecurityActivity.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ApiClientError(403, 'Forbidden'),
    });
    render(<SecurityActivity />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'You do not have permission to review security activity.',
    );
  });

  it('shows the empty state when no events match', () => {
    api.useSecurityActivity.mockReturnValue({
      data: {
        items: [],
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    render(<SecurityActivity />);
    expect(screen.getByText('No security activity found')).toBeInTheDocument();
  });
});
