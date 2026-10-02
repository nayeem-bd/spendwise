import { and, between, desc, eq, isNull, sql, sum } from 'drizzle-orm';

import { monthRange } from '@/utils/date';
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
