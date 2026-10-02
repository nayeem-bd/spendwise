import { desc, eq, isNull } from 'drizzle-orm';

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

/** Newest first. Category/account names come from rows even if those were deleted. */
export function listTransactions(db: LocalDb, limit = 200): TransactionListItem[] {
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
    .where(isNull(transactions.deletedAt))
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
