import {
  formatLocalDate,
  getDueStatus,
  toDate,
  type DueStatus,
} from '@/lib/dates/due-status';
import type {
  BorrowingView,
  MemberPolicyStatusView,
  MemberSelfServiceProfileView,
} from '@/lib/api/types';

export type MemberReminderType =
  | 'due-soon'
  | 'due-today'
  | 'overdue'
  | 'quota-reached'
  | 'suspended'
  | 'inactive';

export type MemberReminderSeverity = 'info' | 'warning' | 'danger';

export interface MemberReminder {
  id: string;
  type: MemberReminderType;
  severity: MemberReminderSeverity;
  title: string;
  message: string;
  borrowingId?: string;
  dueAt?: string;
}

interface DeriveMemberRemindersInput {
  profile: MemberSelfServiceProfileView;
  policy: MemberPolicyStatusView;
  borrowings: BorrowingView[];
  now?: Date;
}

const priority: Record<MemberReminderType, number> = {
  suspended: 0,
  inactive: 0,
  overdue: 10,
  'quota-reached': 20,
  'due-today': 30,
  'due-soon': 40,
};

export function deriveMemberReminders({
  profile,
  policy,
  borrowings,
  now,
}: DeriveMemberRemindersInput): MemberReminder[] {
  const reminders: MemberReminder[] = [];
  const membershipStatus = policy.status ?? profile.membershipStatus;

  if (membershipStatus === 'suspended') {
    reminders.push({
      id: 'account-suspended',
      type: 'suspended',
      severity: 'danger',
      title: 'Membership suspended',
      message:
        'Contact library staff to restore borrowing access before borrowing.',
    });
  }

  if (membershipStatus === 'inactive') {
    reminders.push({
      id: 'account-inactive',
      type: 'inactive',
      severity: 'danger',
      title: 'Membership inactive',
      message:
        'Ask library staff to reactivate your membership before borrowing.',
    });
  }

  for (const borrowing of borrowings) {
    const dueStatus = getBorrowingDueStatus(borrowing, now);
    const reminder = dueReminderForBorrowing(borrowing, dueStatus);

    if (reminder) {
      reminders.push(reminder);
    }
  }

  if (policy.limitReached) {
    reminders.push({
      id: 'quota-reached',
      type: 'quota-reached',
      severity: 'warning',
      title: 'Borrowing limit reached',
      message: 'Return a current book before borrowing another title.',
    });
  }

  return reminders.sort((left, right) => {
    const priorityDelta = priority[left.type] - priority[right.type];

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    if (left.dueAt && right.dueAt) {
      return toDate(left.dueAt).getTime() - toDate(right.dueAt).getTime();
    }

    return 0;
  });
}

function getBorrowingDueStatus(
  borrowing: BorrowingView,
  now?: Date,
): DueStatus {
  if (!borrowing.returnedAt && borrowing.status === 'overdue') {
    return 'overdue';
  }

  return getDueStatus(borrowing.dueAt, {
    returnedAt: borrowing.returnedAt,
    now,
  });
}

function dueReminderForBorrowing(
  borrowing: BorrowingView,
  dueStatus: DueStatus,
): MemberReminder | null {
  const bookTitle = borrowing.bookTitle ?? 'This book';

  if (dueStatus === 'overdue') {
    return {
      id: `overdue-${borrowing.id}`,
      type: 'overdue',
      severity: 'danger',
      title: 'Overdue book',
      message: `Return ${bookTitle} as soon as possible or contact library staff.`,
      borrowingId: borrowing.id,
      dueAt: borrowing.dueAt,
    };
  }

  if (dueStatus === 'due-today') {
    return {
      id: `due-today-${borrowing.id}`,
      type: 'due-today',
      severity: 'warning',
      title: 'Due today',
      message: `${bookTitle} is due today. Return it or renew with staff.`,
      borrowingId: borrowing.id,
      dueAt: borrowing.dueAt,
    };
  }

  if (dueStatus === 'due-soon') {
    return {
      id: `due-soon-${borrowing.id}`,
      type: 'due-soon',
      severity: 'warning',
      title: 'Due soon',
      message: `${bookTitle} is due ${formatLocalDate(
        borrowing.dueAt,
      )}. Plan your return or renewal with staff.`,
      borrowingId: borrowing.id,
      dueAt: borrowing.dueAt,
    };
  }

  return null;
}
