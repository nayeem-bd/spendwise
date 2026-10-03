import { and, between, desc, eq, isNull, sql, sum } from 'drizzle-orm';

import { addMonths, monthRange } from '@/utils/date';
import { addPoisha, type Poisha } from '@/utils/money';

import { categories, transactions } from '../schema';
import type { LocalDb } from '../types';

// Totals are always computed from transactions, never stored.

export type MonthTotals = { income: Poisha; expense: Poisha; balance: Poisha };

export type CategoryTotal = {
  categoryId: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  total: Poisha;
};

const inMonth = (month: string) => {
  const { start, end } = monthRange(month);
  return and(isNull(transactions.deletedAt), between(transactions.occurredOn, start, end));
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
    .where(and(isNull(transactions.deletedAt), between(transactions.occurredOn, start, end)))
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
