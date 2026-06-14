import { differenceInCalendarDays, format, parseISO } from 'date-fns';

export type DueStatus = 'returned' | 'overdue' | 'due-today' | 'due-soon' | 'open';

const DUE_SOON_DAYS = 3;

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

export function formatLocalDate(value: string | Date) {
  return format(toDate(value), 'MMM d, yyyy');
}
