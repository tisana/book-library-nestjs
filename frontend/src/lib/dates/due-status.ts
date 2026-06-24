import { differenceInCalendarDays, format, parseISO } from 'date-fns';

export type DueStatus = 'returned' | 'overdue' | 'due-today' | 'due-soon' | 'open';

const DUE_SOON_DAYS = 3;

export interface DueStateInput {
  id: string;
  dueAt: string | Date;
  returnedAt?: string | Date;
}

export interface ClassifiedDueState {
  id: string;
  status: DueStatus;
}

export function toDate(value: string | Date) {
  return typeof value === 'string' ? parseISO(value) : value;
}

export function getDueStatus(
  dueAt: string | Date,
  options: { returnedAt?: string | Date; now?: Date } = {},
): DueStatus {
  if (options.returnedAt) {
    return 'returned';
  }

  const daysUntilDue = differenceInCalendarDays(
    toDate(dueAt),
    options.now ?? new Date(),
  );

  if (daysUntilDue < 0) {
    return 'overdue';
  }

  if (daysUntilDue === 0) {
    return 'due-today';
  }

  if (daysUntilDue <= DUE_SOON_DAYS) {
    return 'due-soon';
  }

  return 'open';
}

export function classifyDueStates(
  items: DueStateInput[],
  options: { now?: Date } = {},
): ClassifiedDueState[] {
  return items.map((item) => ({
    id: item.id,
    status: getDueStatus(item.dueAt, {
      returnedAt: item.returnedAt,
      now: options.now,
    }),
  }));
}

export function formatLocalDate(value: string | Date) {
  return format(toDate(value), 'MMM d, yyyy');
}
