import { and, asc, count, eq, getTableColumns, isNull, lte, notInArray, or, sql } from 'drizzle-orm';

import type { Poisha } from '@/utils/money';

import { defaultRowId } from '../defaults';
import { newId } from '../id';
import { accounts, transactions, type Account } from '../schema';
import type { LocalDb } from '../types';
import { patchRow, softDeleteRow, upsertRow } from '../write';
import { requireName, ValidationError } from './validate';

export type AccountInput = { name: string; initialBalance: Poisha; icon: string; color: string; savings?: boolean };
export type AccountWithBalance = Account & { balance: Poisha };

const notDeleted = isNull(accounts.deletedAt);

/**
 * True when the transaction's account or destination is a savings account (DPS,
 * FDR, emergency fund…). Those rows stay out of income/expense totals and the
 * main lists. `not exists` keeps rows whose account_id is null in the main view.
 */
export const touchesSavings = sql`exists (select 1 from ${accounts} where ${accounts.savings} = 1
  and ${accounts.id} in (${transactions.accountId}, ${transactions.toAccountId}))`;

export function listAccounts(db: LocalDb): Account[] {
  return db
    .select()
    .from(accounts)
    .where(and(notDeleted, eq(accounts.archived, false)))
    .orderBy(asc(accounts.createdAt), asc(accounts.name))
    .all();
}

/**
 * The owner's "Carryover" income category. Its rows only move a balance into a
 * month's totals, so wallet balances skip them (they'd count the money twice).
 */
export const carryoverCategoryId = (userId: string) => defaultRowId(userId, 'category', 'carryover');

/**
 * Balances are computed from transactions, never stored. `savings` picks savings or regular accounts.
 * `asOf` ('YYYY-MM-DD') gives the balance at the end of that day.
 */
export function listAccountsWithBalance(db: LocalDb, savings: boolean, asOf?: string): AccountWithBalance[] {
  // Carryover rows on an account are written by its owner, so each owner's category id covers them.
  const owners = db.selectDistinct({ userId: accounts.userId }).from(accounts).all();
  const carryover = owners.map((o) => carryoverCategoryId(o.userId));
  const movement = sql<number>`coalesce(sum(case
      when ${transactions.accountId} = ${accounts.id} and ${transactions.type} = 'income' then ${transactions.amount}
      when ${transactions.accountId} = ${accounts.id} then -${transactions.amount}
      when ${transactions.toAccountId} = ${accounts.id} and ${transactions.type} = 'transfer' then ${transactions.amount}
      else 0 end), 0)`;
  return db
    .select({ ...getTableColumns(accounts), balance: sql<Poisha>`${accounts.initialBalance} + ${movement}`.mapWith(Number) })
    .from(accounts)
    .leftJoin(
      transactions,
      and(
        isNull(transactions.deletedAt),
        asOf ? lte(transactions.occurredOn, asOf) : undefined,
        or(isNull(transactions.categoryId), notInArray(transactions.categoryId, carryover)),
        sql`(${transactions.accountId} = ${accounts.id} or ${transactions.toAccountId} = ${accounts.id})`,
      ),
    )
    .where(and(notDeleted, eq(accounts.archived, false), eq(accounts.savings, savings)))
    .groupBy(accounts.id)
    .orderBy(asc(accounts.createdAt), asc(accounts.name))
    .all() as AccountWithBalance[];
}

export function getAccount(db: LocalDb, id: string): Account | undefined {
  return db.select().from(accounts).where(eq(accounts.id, id)).get();
}

export function createAccount(db: LocalDb, userId: string, input: AccountInput): Account {
  return upsertRow(db, accounts, {
    id: newId(),
    userId,
    name: requireName(input.name),
    initialBalance: input.initialBalance,
    icon: input.icon,
    color: input.color,
    archived: false,
    savings: input.savings ?? false,
  });
}

export function updateAccount(db: LocalDb, id: string, input: Partial<AccountInput>): Account {
  if (input.savings && !getAccount(db, id)?.savings) requireAnotherRegular(db);
  return patchRow(db, accounts, id, {
    ...input,
    ...(input.name !== undefined && { name: requireName(input.name) }),
  });
}

/** Expenses and income need a regular account: refuse to remove or convert the last one. */
function requireAnotherRegular(db: LocalDb): void {
  const regular = db
    .select({ n: count() })
    .from(accounts)
    .where(and(notDeleted, eq(accounts.archived, false), eq(accounts.savings, false)))
    .get();
  if ((regular?.n ?? 0) <= 1) throw new ValidationError('You need at least one account');
}

/** Soft delete. The last regular account can't be deleted: transactions need one. */
export function deleteAccount(db: LocalDb, id: string): void {
  if (!getAccount(db, id)?.savings) requireAnotherRegular(db);
  softDeleteRow(db, accounts, id);
}
