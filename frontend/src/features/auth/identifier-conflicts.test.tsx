import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api/client';
import { IdentifierConflicts } from './identifier-conflicts';

const api = vi.hoisted(() => ({
  useIdentifierConflicts: vi.fn(),
  useIdentifierOperation: vi.fn(),
  useResolveIdentifierConflict: vi.fn(),
  resolve: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  useIdentifierConflicts: api.useIdentifierConflicts,
  useIdentifierOperation: api.useIdentifierOperation,
  useResolveIdentifierConflict: api.useResolveIdentifierConflict,
}));

const conflict = {
  id: 'conflict-1',
  normalizedIdentifier: 'shared@example.test',
  resolutionStatus: 'reviewable',
  subjects: [
    {
      subjectType: 'staff',
      subjectId: 'staff-1',
      displayLabel: 'Staff account: Li*** A***',
    },
    {
      subjectType: 'member',
      subjectId: 'member-1',
      displayLabel: 'Member account: M-1***',
    },
  ],
};

describe('IdentifierConflicts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.useIdentifierConflicts.mockReturnValue({
      data: [conflict],
      isLoading: false,
      isError: false,
      error: null,
    });
    api.resolve.mockResolvedValue({
      operationId: 'operation-1',
      status: 'completed',
      replayed: false,
      outcome: 'success',
      reasonCategory: 'identifier-conflict-resolved',
    });
    api.useResolveIdentifierConflict.mockReturnValue({
      mutateAsync: api.resolve,
      isPending: false,
    });
    api.useIdentifierOperation.mockImplementation((operationId?: string) => ({
      data: operationId
        ? { operationId, status: 'completed', subjects: [] }
        : undefined,
    }));
  });

  it('uses safe labels, validates replacements, and resolves a fully accounted conflict', async () => {
    const user = userEvent.setup();
    render(<IdentifierConflicts />);

    expect(screen.getByText('Staff account: Li*** A*** (staff)')).toBeInTheDocument();
    expect(screen.getByText('Member account: M-1*** (member)')).toBeInTheDocument();
    await user.type(
      screen.getByLabelText('Replacement for Staff account: Li*** A***'),
      'duplicate@example.test',
    );
    await user.type(
      screen.getByLabelText('Replacement for Member account: M-1***'),
      'DUPLICATE@example.test',
    );
    await user.click(screen.getByRole('button', { name: 'Resolve conflict' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Replacement identifiers must be unique.',
    );
    expect(api.resolve).not.toHaveBeenCalled();

    await user.selectOptions(
      screen.getByLabelText('Account retaining current identifier'),
      'staff:staff-1',
    );
    const memberReplacement = screen.getByLabelText(
      'Replacement for Member account: M-1***',
    );
    await user.clear(memberReplacement);
    await user.type(
      memberReplacement,
      'member.one@example.test',
    );
    await user.click(screen.getByRole('button', { name: 'Resolve conflict' }));

    await waitFor(() => expect(api.resolve).toHaveBeenCalledTimes(1));
    expect(api.resolve).toHaveBeenCalledWith({
      conflictId: 'conflict-1',
      input: expect.objectContaining({
        operationId: expect.any(String),
        retainedSubject: { subjectType: 'staff', subjectId: 'staff-1' },
        reassignments: [
          {
            subjectType: 'member',
            subjectId: 'member-1',
            newIdentifier: 'member.one@example.test',
          },
        ],
      }),
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Resolution completed',
    );
  }, 10_000);

  it('shows manual repair and forbidden states without exposing controls', () => {
    api.useIdentifierConflicts.mockReturnValueOnce({
      data: [{ ...conflict, resolutionStatus: 'manual-repair-required' }],
      isLoading: false,
      isError: false,
      error: null,
    });
    const { rerender } = render(<IdentifierConflicts />);
    expect(screen.getByText('Manual repair required')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resolve conflict' })).toBeNull();

    api.useIdentifierConflicts.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ApiClientError(403, 'Forbidden'),
    });
    rerender(<IdentifierConflicts />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'You do not have permission to review identifier conflicts.',
    );
  });
});
