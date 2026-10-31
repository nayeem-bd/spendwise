import { and, between, count, desc, eq, isNotNull, isNull, max, not, sql, sum } from 'drizzle-orm';

import { addMonths, monthOf, monthRange } from '@/utils/date';
import { addPoisha, type Poisha } from '@/utils/money';

import { categories, transactions } from '../schema';
import { touchesSavings } from './accounts';
import type { LocalDb } from '../types';

// Totals are always computed from transactions, never stored.
// Rows on savings accounts (DPS, emergency fund…) are left out of every total.

export type MonthTotals = { income: Poisha; expense: Poisha; balance: Poisha };

export type CategoryTotal = {
  categoryId: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  total: Poisha;
  count: number;
};

const inMonth = (month: string) => {
  const { start, end } = monthRange(month);
  return and(isNull(transactions.deletedAt), between(transactions.occurredOn, start, end), not(touchesSavings));
};

export function monthTotals(db: LocalDb, month: string): MonthTotals {
  const rows = db
    .select({ type: transactions.type, total: sum(transactions.amount).mapWith(Number) })
    .from(transactions)
    .where(inMonth(month))
    .groupBy(transactions.type)
    .all();
  const get = (type: 'income' | 'expense') => (rows.find((r) => r.type === type)?.total ?? 0) as Poisha;
  const income = get('income');
  const expense = get('expense');
  return { income, expense, balance: addPoisha(income, -expense as Poisha) };
}

/** Expense per category for the month, biggest first. Deleted categories keep their name. */
export function expenseByCategory(db: LocalDb, month: string): CategoryTotal[] {
  const total = sum(transactions.amount).mapWith(Number);
  return db
    .select({
      categoryId: transactions.categoryId,
      name: sql<string>`coalesce(${categories.name}, 'Uncategorized')`,
      icon: categories.icon,
      color: categories.color,
      total,
      count: count(),
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(inMonth(month), eq(transactions.type, 'expense')))
    .groupBy(transactions.categoryId)
    .orderBy(desc(total))
    .all() as CategoryTotal[];
}

export type MonthPoint = { month: string; income: Poisha; expense: Poisha };

/** Income and expense for `count` months ending at `endMonth`, oldest first, zero-filled. */
export function monthlyTrend(db: LocalDb, endMonth: string, count = 6): MonthPoint[] {
  const months = Array.from({ length: count }, (_, i) => addMonths(endMonth, i - count + 1));
  const start = monthRange(months[0]!).start;
  const end = monthRange(endMonth).end;
  const month = sql<string>`substr(${transactions.occurredOn}, 1, 7)`;
  const rows = db
    .select({ month, type: transactions.type, total: sum(transactions.amount).mapWith(Number) })
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), between(transactions.occurredOn, start, end), not(touchesSavings)))
    .groupBy(month, transactions.type)
    .all();
  return months.map((m) => {
    const get = (type: 'income' | 'expense') => (rows.find((r) => r.month === m && r.type === type)?.total ?? 0) as Poisha;
    return { month: m, income: get('income'), expense: get('expense') };
  });
}

export type CategoryChange = CategoryTotal & { previous: Poisha; change: Poisha };

/** Expense per category this month vs the month before, biggest this month first. */
export function categoryComparison(db: LocalDb, month: string): CategoryChange[] {
  const current = expenseByCategory(db, month);
  const previous = expenseByCategory(db, addMonths(month, -1));
  const byId = new Map<string | null, CategoryChange>();
  for (const c of current) byId.set(c.categoryId, { ...c, previous: 0 as Poisha, change: c.total });
  for (const p of previous) {
    const existing = byId.get(p.categoryId);
    if (existing) {
      existing.previous = p.total;
      existing.change = (existing.total - p.total) as Poisha;
    } else {
      byId.set(p.categoryId, { ...p, total: 0 as Poisha, previous: p.total, change: -p.total as Poisha });
    }
  }
  return [...byId.values()].sort((a, b) => b.total - a.total || b.previous - a.previous);
}

/** Expense per day of the month: index 0 is the 1st. Zero-filled to the month's length. */
export function dailyExpense(db: LocalDb, month: string): Poisha[] {
  const { end } = monthRange(month);
  const rows = db
    .select({ day: transactions.occurredOn, total: sum(transactions.amount).mapWith(Number) })
    .from(transactions)
    .where(and(inMonth(month), eq(transactions.type, 'expense')))
    .groupBy(transactions.occurredOn)
    .all();
  const days = Array.from({ length: Number(end.slice(8)) }, () => 0 as Poisha);
  for (const r of rows) days[Number(r.day.slice(8)) - 1] = r.total as Poisha;
  return days;
}

/** Notes used most with a category, most frequent then most recent first: quick picks for the add screen. */
export function frequentNotes(db: LocalDb, categoryId: string, limit = 6): string[] {
  return db
    .select({ note: transactions.note })
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), eq(transactions.categoryId, categoryId), isNotNull(transactions.note)))
    .groupBy(transactions.note)
    .orderBy(desc(count()), desc(max(transactions.occurredOn)))
    .limit(limit)
    .all()
    .map((r) => r.note!);
}

export type Pace = { today: Poisha; averagePerDay: Poisha; elapsed: number };

/**
 * Today's spending and the average per day so far, from `dailyExpense`. Null
 * unless `month` is the current one: past months have no "today", future ones no pace.
 */
export function spendingPace(days: Poisha[], month: string, today: string): Pace | null {
  if (monthOf(today) !== month) return null;
  const elapsed = Number(today.slice(8));
  const spent = days.slice(0, elapsed).reduce((a, b) => a + b, 0);
  return { today: days[elapsed - 1] ?? (0 as Poisha), averagePerDay: (Math.round(spent / elapsed / 100) * 100) as Poisha /* whole taka: paisa is noise in an average */, elapsed };
}
