import { AlertCircle, Bell, CircleAlert } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import { cn } from '@/lib/utils';
import type {
  MemberReminder,
  MemberReminderSeverity,
} from './reminders';

interface RemindersPanelProps {
  reminders: MemberReminder[];
}

const panelClasses: Record<MemberReminderSeverity, string> = {
  danger: 'border-rose-200 bg-rose-50 text-rose-950',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  info: 'border-cyan-200 bg-cyan-50 text-cyan-950',
};

const iconClasses: Record<MemberReminderSeverity, string> = {
  danger: 'text-rose-700',
  warning: 'text-amber-700',
  info: 'text-cyan-700',
};

const badgeLabels: Record<MemberReminderSeverity, string> = {
  danger: 'Action needed',
  warning: 'Reminder',
  info: 'Notice',
};

export function RemindersPanel({ reminders }: RemindersPanelProps) {
  if (reminders.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="member-reminders"
      aria-live="polite"
      className="flex flex-col gap-2"
    >
      <div className="flex items-center gap-2">
        <Bell aria-hidden="true" className="h-4 w-4 text-cyan-800" />
        <h2
          id="member-reminders"
          className="text-sm font-semibold text-slate-950"
        >
          Member reminders
        </h2>
      </div>
      <ul className="flex flex-col gap-2">
        {reminders.map((reminder) => {
          const Icon =
            reminder.severity === 'danger' ? CircleAlert : AlertCircle;

          return (
            <li
              key={reminder.id}
              className={cn(
                'rounded-md border p-3',
                panelClasses[reminder.severity],
              )}
            >
              <div className="flex items-start gap-3">
                <Icon
                  aria-hidden="true"
                  className={cn('mt-0.5 h-4 w-4 shrink-0', iconClasses[reminder.severity])}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{reminder.title}</p>
                    <StatusBadge
                      tone={
                        reminder.severity === 'danger' ? 'danger' : 'warning'
                      }
                    >
                      {badgeLabels[reminder.severity]}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm leading-5">{reminder.message}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
