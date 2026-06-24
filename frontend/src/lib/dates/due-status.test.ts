import { describe, expect, it } from 'vitest';
import { classifyDueStates, getDueStatus } from './due-status';

const now = new Date('2026-06-17T12:00:00.000Z');

describe('due status classification', () => {
  it('classifies returned, overdue, due-today, due-soon, and open due dates', () => {
    expect(
      getDueStatus('2026-06-10T12:00:00.000Z', {
        returnedAt: '2026-06-12T12:00:00.000Z',
        now,
      }),
    ).toBe('returned');
    expect(getDueStatus('2026-06-16T12:00:00.000Z', { now })).toBe(
      'overdue',
    );
    expect(getDueStatus('2026-06-17T12:00:00.000Z', { now })).toBe(
      'due-today',
    );
    expect(getDueStatus('2026-06-20T12:00:00.000Z', { now })).toBe(
      'due-soon',
    );
    expect(getDueStatus('2026-06-24T12:00:00.000Z', { now })).toBe('open');
  });

  it('classifies mixed borrowing due states without treating returned records as overdue', () => {
    const statuses = classifyDueStates(
      [
        {
          id: 'returned-overdue-window',
          dueAt: '2026-06-10T12:00:00.000Z',
          returnedAt: '2026-06-16T12:00:00.000Z',
        },
        { id: 'overdue', dueAt: '2026-06-16T12:00:00.000Z' },
        { id: 'today', dueAt: '2026-06-17T12:00:00.000Z' },
        { id: 'soon', dueAt: '2026-06-19T12:00:00.000Z' },
        { id: 'open', dueAt: '2026-06-25T12:00:00.000Z' },
      ],
      { now },
    );

    expect(statuses).toEqual([
      { id: 'returned-overdue-window', status: 'returned' },
      { id: 'overdue', status: 'overdue' },
      { id: 'today', status: 'due-today' },
      { id: 'soon', status: 'due-soon' },
      { id: 'open', status: 'open' },
    ]);
  });
});
