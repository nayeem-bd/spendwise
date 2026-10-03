import { desc, lte } from 'drizzle-orm';

import type { Poisha } from '@/utils/money';

import { budgets, categories, type Budget } from '../schema';
import type { LocalDb } from '../types';
import { uuidv5 } from '../uuidv5';
import { softDeleteRow, upsertRow } from '../write';
import { expenseByCategory, monthTotals } from './summary';
import { ValidationError } from './validate';

// Monthly budgets, per category or for the whole month (categoryId null).
//
// A budget carries forward: a month with no row of its own uses the latest
// earlier row for that category. Removing a budget writes a deleted row for
// that month, which stops the carry-forward from then on.
//
// Ids are UUIDv5(user, 'budget:<category|total>:<YYYY-MM>'), so two devices
// setting the same budget offline write the same row instead of colliding on
// the server's unique (user_id, category_id, month).

export type BudgetLevel = 'ok' | 'warning' | 'over';

export type BudgetStatus = {
  categoryId: string | null; // null = whole month
  name: string;
  icon: string | null;
  color: string | null;
  amount: Poisha;
  spent: Poisha;
  ratio: number; // spent / amount
  level: BudgetLevel;
  /** 'YYYY-MM' the amount was set in, when carried forward from an earlier month. */
  carriedFrom: string | null;
};

export const WARNING_RATIO = 0.8;

export const levelOf = (ratio: number): BudgetLevel => (ratio >= 1 ? 'over' : ratio >= WARNING_RATIO ? 'warning' : 'ok');

export const budgetId = (userId: string, categoryId: string | null, month: string) =>
  uuidv5(`budget:${categoryId ?? 'total'}:${month}`, userId);

const firstDay = (month: string) => `${month}-01`;

/** The budget row in effect for each category in `month` (latest row at or before it), deleted ones excluded. */
function effectiveRows(db: LocalDb, month: string): Budget[] {
  const rows = db
    .select()
    .from(budgets)
    .where(lte(budgets.month, firstDay(month)))
    .orderBy(desc(budgets.month))
    .all();
  const latest = new Map<string, Budget>();
  for (const row of rows) {
    const key = row.categoryId ?? 'total';
    if (!latest.has(key)) latest.set(key, row);
  }
  return [...latest.values()].filter((r) => r.deletedAt === null);
}

export function getBudget(db: LocalDb, categoryId: string | null, month: string): Budget | undefined {
  return effectiveRows(db, month).find((r) => r.categoryId === categoryId);
}

export function setBudget(
  db: LocalDb,
  userId: string,
  input: { categoryId: string | null; month: string; amount: Poisha },
): Budget {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new ValidationError('Enter a budget above ৳0');
  if (!/^\d{4}-\d{2}$/.test(input.month)) throw new ValidationError('Invalid month');
  return upsertRow(db, budgets, {
    id: budgetId(userId, input.categoryId, input.month),
    userId,
    categoryId: input.categoryId,
    month: firstDay(input.month),
    amount: input.amount,
  });
}

/** Removes the budget from `month` onwards; earlier months keep theirs. */
export function removeBudget(db: LocalDb, userId: string, categoryId: string | null, month: string): void {
  const current = getBudget(db, categoryId, month);
  if (!current) return;
  // Make sure this month has its own row, then delete it as the "stop" marker.
  const own = setBudget(db, userId, { categoryId, month, amount: current.amount });
  softDeleteRow(db, budgets, own.id);
}

/** Every budget in effect for the month with what has been spent against it. Biggest ratio first. */
export function budgetStatuses(db: LocalDb, month: string): { total: BudgetStatus | null; categories: BudgetStatus[] } {
  const rows = effectiveRows(db, month);
  if (rows.length === 0) return { total: null, categories: [] };

  const spentByCategory = new Map(expenseByCategory(db, month).map((c) => [c.categoryId, c.total]));
  const totalSpent = monthTotals(db, month).expense;
  const names = new Map(
    db
      .select({ id: categories.id, name: categories.name, icon: categories.icon, color: categories.color, deletedAt: categories.deletedAt })
      .from(categories)
      .all()
      .map((c) => [c.id, c]),
  );

  const status = (row: Budget, spent: Poisha, name: string, icon: string | null, color: string | null): BudgetStatus => {
    const ratio = spent / row.amount;
    const rowMonth = row.month.slice(0, 7);
    return {
      categoryId: row.categoryId,
      name,
      icon,
      color,
      amount: row.amount,
      spent,
      ratio,
      level: levelOf(ratio),
      carriedFrom: rowMonth === month ? null : rowMonth,
    };
  };

  let total: BudgetStatus | null = null;
  const list: BudgetStatus[] = [];
  for (const row of rows) {
    if (row.categoryId === null) {
      total = status(row, totalSpent, 'This month', 'calendar-month', null);
      continue;
    }
    const category = names.get(row.categoryId);
    if (!category || category.deletedAt) continue; // category was deleted
    list.push(status(row, (spentByCategory.get(row.categoryId) ?? 0) as Poisha, category.name, category.icon, category.color));
  }
  list.sort((a, b) => b.ratio - a.ratio || a.name.localeCompare(b.name));
  return { total, categories: list };
}

/** Budgets whose level went up (ok → warning/over, warning → over) between two snapshots. */
export function budgetCrossings(
  before: ReturnType<typeof budgetStatuses>,
  after: ReturnType<typeof budgetStatuses>,
): BudgetStatus[] {
  const rank: Record<BudgetLevel, number> = { ok: 0, warning: 1, over: 2 };
  const prev = new Map([...(before.total ? [before.total] : []), ...before.categories].map((s) => [s.categoryId, s.level]));
  return [...(after.total ? [after.total] : []), ...after.categories].filter(
    (s) => s.level !== 'ok' && rank[s.level] > rank[prev.get(s.categoryId) ?? 'ok'],
  );
}
