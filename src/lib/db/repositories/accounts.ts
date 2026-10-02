import { and, asc, count, eq, getTableColumns, isNull, sql } from 'drizzle-orm';

import type { Poisha } from '@/utils/money';

import { newId } from '../id';
import { accounts, transactions, type Account } from '../schema';
import type { LocalDb } from '../types';
import { patchRow, softDeleteRow, upsertRow } from '../write';
import { requireName, ValidationError } from './validate';

export type AccountInput = { name: string; initialBalance: Poisha; icon: string; color: string };
export type AccountWithBalance = Account & { balance: Poisha };

const notDeleted = isNull(accounts.deletedAt);

export function listAccounts(db: LocalDb): Account[] {
  return db
    .select()
    .from(accounts)
    .where(and(notDeleted, eq(accounts.archived, false)))
    .orderBy(asc(accounts.createdAt), asc(accounts.name))
    .all();
}

/** Balances are computed from transactions, never stored. */
export function listAccountsWithBalance(db: LocalDb): AccountWithBalance[] {
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
        sql`(${transactions.accountId} = ${accounts.id} or ${transactions.toAccountId} = ${accounts.id})`,
      ),
    )
    .where(and(notDeleted, eq(accounts.archived, false)))
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
  });
}

export function updateAccount(db: LocalDb, id: string, input: Partial<AccountInput>): Account {
  return patchRow(db, accounts, id, {
    ...input,
    ...(input.name !== undefined && { name: requireName(input.name) }),
  });
}

/** Soft delete. The last account can't be deleted: transactions need one. */
export function deleteAccount(db: LocalDb, id: string): void {
  const remaining = db.select({ n: count() }).from(accounts).where(and(notDeleted, eq(accounts.archived, false))).get();
  if ((remaining?.n ?? 0) <= 1) throw new ValidationError('You need at least one account');
  softDeleteRow(db, accounts, id);
}
