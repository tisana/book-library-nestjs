import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { delay, http, HttpResponse } from 'msw';
import { apiBaseUrl } from '@/lib/api/client';
import { server } from '@/test/mocks/server';
import { IdentifierConflicts } from './identifier-conflicts';

const reviewableConflict = {
  id: 'conflict-1', normalizedIdentifier: 'shared@example.test', resolutionStatus: 'reviewable',
  subjects: [
    { subjectType: 'staff', subjectId: 'staff-1', displayLabel: 'Staff account: Li*** A***' },
    { subjectType: 'member', subjectId: 'member-1', displayLabel: 'Member account: M-1***' },
  ],
};

function renderConflicts() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><IdentifierConflicts /></QueryClientProvider>);
}

describe('IdentifierConflicts MSW integration', () => {
  it('shows a visible loading state through the real conflict query', async () => {
    server.use(http.get(`${apiBaseUrl}/auth/identifier-conflicts`, async () => {
      await delay(20);
      return HttpResponse.json([reviewableConflict]);
    }));
    renderConflicts();

    expect(screen.getByText('Loading identifier conflicts')).toBeInTheDocument();
    expect(await screen.findByText('shared@example.test')).toBeInTheDocument();
  });

  it('retries a safe failure, completes resolution, and removes stale conflict data after refetch', async () => {
    const user = userEvent.setup();
    let resolved = false;
    let resolutionAttempts = 0;
    server.use(
      http.get(`${apiBaseUrl}/auth/identifier-conflicts`, () =>
        HttpResponse.json(resolved ? [] : [reviewableConflict]),
      ),
      http.post(`${apiBaseUrl}/auth/identifier-conflicts/conflict-1/resolve`, () => {
        resolutionAttempts += 1;
        if (resolutionAttempts === 1) {
          return HttpResponse.json({ message: 'stale transport detail' }, { status: 500 });
        }
        resolved = true;
        return HttpResponse.json({ operationId: 'operation-1', status: 'completed', replayed: false, outcome: 'success', reasonCategory: 'identifier-conflict-resolved' });
      }),
      http.get(`${apiBaseUrl}/auth/identifier-operations/operation-1`, () =>
        HttpResponse.json({ operationId: 'operation-1', status: 'completed', subjects: [] }),
      ),
    );
    renderConflicts();
    await user.selectOptions(await screen.findByLabelText('Account retaining current identifier'), 'staff:staff-1');
    await user.type(screen.getByLabelText('Replacement for Member account: M-1***'), 'member.one@example.test');
    await user.click(screen.getByRole('button', { name: 'Resolve conflict' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Identifier conflict could not be resolved.');
    expect(screen.queryByText(/stale transport detail/i)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Resolve conflict' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Resolution completed');
    expect(await screen.findByText('No identifier conflicts require review.')).toBeInTheDocument();
    expect(resolutionAttempts).toBe(2);
  });

  it('shows manual-repair-only and forbidden states without mutation controls', async () => {
    server.use(http.get(`${apiBaseUrl}/auth/identifier-conflicts`, () =>
      HttpResponse.json([{ ...reviewableConflict, resolutionStatus: 'manual-repair-required' }]),
    ));
    const { unmount } = renderConflicts();
    expect(await screen.findByText('Manual repair required')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resolve conflict' })).toBeNull();
    unmount();

    server.use(http.get(`${apiBaseUrl}/auth/identifier-conflicts`, () => HttpResponse.json({}, { status: 403 })));
    renderConflicts();
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to review identifier conflicts.');
  });
});
