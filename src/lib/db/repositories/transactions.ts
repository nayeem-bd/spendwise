import { and, between, desc, eq, isNull } from 'drizzle-orm';

import { monthRange } from '@/utils/date';

import type { Poisha } from '@/utils/money';

import { newId } from '../id';
import { accounts, categories, transactions, type Transaction } from '../schema';
import type { LocalDb } from '../types';
import { patchRow, softDeleteRow, upsertRow } from '../write';
import { ValidationError } from './validate';

export type TransactionInput = {
  type: 'expense' | 'income';
  amount: Poisha;
  categoryId: string;
  accountId: string;
  note: string | null;
  occurredOn: string; // 'YYYY-MM-DD'
};

export type TransactionListItem = Transaction & {
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  accountName: string | null;
};

function validate(input: TransactionInput): TransactionInput {
  if (input.type !== 'expense' && input.type !== 'income') throw new ValidationError('Invalid type');
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new ValidationError('Enter an amount above ৳0');
  if (!input.categoryId) throw new ValidationError('Pick a category');
  if (!input.accountId) throw new ValidationError('Pick an account');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn)) throw new ValidationError('Invalid date');
  const note = input.note?.trim() || null;
  return { ...input, note };
}

/** Creates a transaction, or updates it when `id` is given. */
export function saveTransaction(db: LocalDb, userId: string, input: TransactionInput, id?: string): Transaction {
  const valid = validate(input);
  if (id) return patchRow(db, transactions, id, valid);
  return upsertRow(db, transactions, { id: newId(), userId, ...valid, toAccountId: null, recurringId: null });
}

export function deleteTransaction(db: LocalDb, id: string): void {
  softDeleteRow(db, transactions, id);
}

export function getTransaction(db: LocalDb, id: string): Transaction | undefined {
  return db.select().from(transactions).where(eq(transactions.id, id)).get();
}

/**
 * Newest first, optionally for one month ('YYYY-MM'). Category/account names
 * come from rows even if those were deleted.
 */
export function listTransactions(db: LocalDb, options: { month?: string; limit?: number } = {}): TransactionListItem[] {
  const { month, limit = 1000 } = options;
  const range = month ? monthRange(month) : null;
  return db
    .select({
      ...transactionColumns,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      accountName: accounts.name,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(and(isNull(transactions.deletedAt), range ? between(transactions.occurredOn, range.start, range.end) : undefined))
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
    .limit(limit)
    .all();
}

const transactionColumns = {
  id: transactions.id,
  userId: transactions.userId,
  createdAt: transactions.createdAt,
  updatedAt: transactions.updatedAt,
  deletedAt: transactions.deletedAt,
  serverSeq: transactions.serverSeq,
  accountId: transactions.accountId,
  categoryId: transactions.categoryId,
  type: transactions.type,
  amount: transactions.amount,
  toAccountId: transactions.toAccountId,
  note: transactions.note,
  occurredOn: transactions.occurredOn,
  recurringId: transactions.recurringId,
};

export type DaySection = { day: string; net: Poisha; data: TransactionListItem[] };

/** Groups a newest-first list into days, with each day's income minus expense. */
export function groupByDay(items: readonly TransactionListItem[]): DaySection[] {
  const sections: DaySection[] = [];
  for (const item of items) {
    let section = sections.at(-1);
    if (!section || section.day !== item.occurredOn) {
      section = { day: item.occurredOn, net: 0 as Poisha, data: [] };
      sections.push(section);
    }
    section.data.push(item);
    const signed = item.type === 'income' ? item.amount : item.type === 'expense' ? -item.amount : 0;
    section.net = (section.net + signed) as Poisha;
  }
  return sections;
}
