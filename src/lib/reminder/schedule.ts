import { addDays } from '@/utils/date';

export const REMINDER_DAYS_AHEAD = 14;

/**
 * Days ('YYYY-MM-DD') to remind on, starting today. Today is skipped when
 * something was already logged or the reminder time has passed.
 * `minutes` is minutes after midnight (e.g. 21:00 = 1260).
 */
export function reminderDays(
  today: string,
  nowMinutes: number,
  loggedToday: boolean,
  minutes: number,
  daysAhead = REMINDER_DAYS_AHEAD,
): string[] {
  const days: string[] = [];
  for (let i = 0; i < daysAhead; i++) {
    if (i === 0 && (loggedToday || nowMinutes >= minutes)) continue;
    days.push(addDays(today, i));
  }
  return days;
}

/** Local Date for a day + minutes after midnight. */
export function atLocalTime(day: string, minutes: number): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!, Math.floor(minutes / 60), minutes % 60, 0, 0);
}
