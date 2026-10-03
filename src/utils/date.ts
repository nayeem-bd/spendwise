// Dates are plain 'YYYY-MM-DD' strings in the user's local calendar.
// Arithmetic is done in UTC on those strings so DST never shifts a day.

const pad = (n: number) => String(n).padStart(2, '0');

export function todayISO(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const toUTC = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
};

export function addDays(iso: string, days: number): string {
  const date = toUTC(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Today", "Yesterday", or "Sat, 3 Oct 2026". */
export function formatDay(iso: string, today = todayISO()): string {
  if (iso === today) return 'Today';
  if (iso === addDays(today, -1)) return 'Yesterday';
  if (iso === addDays(today, 1)) return 'Tomorrow';
  const d = toUTC(iso);
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ---- Months ('YYYY-MM') ----

export const monthOf = (iso: string): string => iso.slice(0, 7);

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const index = y! * 12 + (m! - 1) + n;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** First and last day of a month as 'YYYY-MM-DD'. */
export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${pad(lastDay)}` };
}

/** "Oct 2026" */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m! - 1]} ${y}`;
}

// ---- Recurrence ----

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

const daysInMonth = (year: number, month1: number) => new Date(Date.UTC(year, month1, 0)).getUTCDate();

/**
 * The occurrence after `iso`. Monthly and yearly keep the original day of
 * month (`anchorDay`), clamped to short months: an anchor of 31 gives
 * Jan 31 → Feb 28 → Mar 31, never drifting to the 28th.
 */
export function nextOccurrence(iso: string, frequency: Frequency, anchorDay: number): string {
  if (frequency === 'daily') return addDays(iso, 1);
  if (frequency === 'weekly') return addDays(iso, 7);
  const [y, m] = iso.split('-').map(Number);
  let year = y!;
  let month = m!;
  if (frequency === 'monthly') {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  } else {
    year += 1;
  }
  const day = Math.min(anchorDay, daysInMonth(year, month));
  return `${year}-${pad(month)}-${pad(day)}`;
}
