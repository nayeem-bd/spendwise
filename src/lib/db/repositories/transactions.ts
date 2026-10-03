import { and, between, desc, eq, getTableColumns, gte, inArray, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import { monthRange } from '@/utils/date';

import type { Poisha } from '@/utils/money';

import { newId } from '../id';
import { accounts, categories, transactions, type Transaction } from '../schema';
import type { LocalDb } from '../types';
import { patchRow, softDeleteRow, upsertRow } from '../write';
import { deleteAttachmentsOf } from './attachments';
import { ValidationError } from './validate';

type Common = {
  amount: Poisha;
  accountId: string;
  note: string | null;
  occurredOn: string; // 'YYYY-MM-DD'
};

export type TransactionInput =
  | (Common & { type: 'expense' | 'income'; categoryId: string })
  | (Common & { type: 'transfer'; toAccountId: string });

/** An expense or income (has a category). */
export type EntryInput = Extract<TransactionInput, { type: 'expense' | 'income' }>;

export type TransactionListItem = Transaction & {
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  accountName: string | null;
  toAccountName: string | null;
};

/** Validated fields as stored: transfers have no category, others no destination. */
export type ValidFields = Common & { type: Transaction['type']; categoryId: string | null; toAccountId: string | null };

export function validateTransaction(input: TransactionInput): ValidFields {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new ValidationError('Enter an amount above ৳0');
  if (!input.accountId) throw new ValidationError(input.type === 'transfer' ? 'Pick the account to move from' : 'Pick an account');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn)) throw new ValidationError('Invalid date');
  const note = input.note?.trim() || null;
  const common = { amount: input.amount, accountId: input.accountId, occurredOn: input.occurredOn, note };

  switch (input.type) {
    case 'expense':
    case 'income':
      if (!input.categoryId) throw new ValidationError('Pick a category');
      return { ...common, type: input.type, categoryId: input.categoryId, toAccountId: null };
    case 'transfer':
      if (!input.toAccountId) throw new ValidationError('Pick the account to move to');
      if (input.toAccountId === input.accountId) throw new ValidationError('Pick two different accounts');
      return { ...common, type: 'transfer', categoryId: null, toAccountId: input.toAccountId };
    default:
      throw new ValidationError('Invalid type');
  }
}

/** Creates a transaction, or updates it when `id` is given. */
export function saveTransaction(db: LocalDb, userId: string, input: TransactionInput, id?: string): Transaction {
  const valid = validateTransaction(input);
  if (id) return patchRow(db, transactions, id, valid);
  return upsertRow(db, transactions, { id: newId(), userId, ...valid, recurringId: null });
}

export function deleteTransaction(db: LocalDb, id: string): void {
  softDeleteRow(db, transactions, id);
  deleteAttachmentsOf(db, id);
}

export function getTransaction(db: LocalDb, id: string): Transaction | undefined {
  return db.select().from(transactions).where(eq(transactions.id, id)).get();
}

const toAccounts = alias(accounts, 'to_accounts');

function selectList(db: LocalDb, where: SQL | undefined, limit: number): TransactionListItem[] {
  return db
    .select({
      ...getTableColumns(transactions),
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      accountName: accounts.name,
      toAccountName: toAccounts.name,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(accounts, eq(accounts.id, transactions.accountId))
    .leftJoin(toAccounts, eq(toAccounts.id, transactions.toAccountId))
    .where(and(isNull(transactions.deletedAt), where))
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
    .limit(limit)
    .all();
}

/**
 * Newest first, optionally for one month ('YYYY-MM'). Category/account names
 * come from rows even if those were deleted.
 */
export function listTransactions(db: LocalDb, options: { month?: string; limit?: number } = {}): TransactionListItem[] {
  const { month, limit = 1000 } = options;
  const range = month ? monthRange(month) : null;
  return selectList(db, range ? between(transactions.occurredOn, range.start, range.end) : undefined, limit);
}

export type TransactionFilter = {
  /** Matches the note, category name or account name (case-insensitive). */
  text?: string;
  types?: Transaction['type'][];
  categoryIds?: string[];
  from?: string; // 'YYYY-MM-DD', inclusive
  to?: string;
  minAmount?: Poisha;
  maxAmount?: Poisha;
};

/** LIKE pattern for a literal substring: % and _ in user input are not wildcards. */
const containsPattern = (text: string) => `%${text.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export function searchTransactions(db: LocalDb, filter: TransactionFilter, limit = 2000): TransactionListItem[] {
  const conditions: (SQL | undefined)[] = [];
  const text = filter.text?.trim();
  if (text) {
    const pattern = containsPattern(text);
    const like = (column: SQL | typeof transactions.note) => sql`lower(${column}) like ${pattern} escape '\\'`;
    conditions.push(or(like(transactions.note), like(sql`${categories.name}`), like(sql`${accounts.name}`), like(sql`${toAccounts.name}`)));
  }
  if (filter.types?.length) conditions.push(inArray(transactions.type, filter.types));
  if (filter.categoryIds?.length) conditions.push(inArray(transactions.categoryId, filter.categoryIds));
  if (filter.from) conditions.push(gte(transactions.occurredOn, filter.from));
  if (filter.to) conditions.push(lte(transactions.occurredOn, filter.to));
  if (filter.minAmount !== undefined) conditions.push(gte(transactions.amount, filter.minAmount));
  if (filter.maxAmount !== undefined) conditions.push(lte(transactions.amount, filter.maxAmount));
  return selectList(db, and(...conditions), limit);
}

/** Income and expense totals of a list (transfers excluded). */
export function totalsOf(items: readonly TransactionListItem[]): { income: Poisha; expense: Poisha } {
  let income = 0;
  let expense = 0;
  for (const t of items) {
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  }
  return { income: income as Poisha, expense: expense as Poisha };
}

export type DaySection = { day: string; net: Poisha; data: TransactionListItem[] };

/** Groups a newest-first list into days, with each day's income minus expense (transfers don't count). */
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
