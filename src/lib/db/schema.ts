import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { Frequency } from '@/utils/date';
import type { Poisha } from '@/utils/money';

// Local mirror of the Supabase tables in supabase/migrations.
// Differences from Postgres: money is integer poisha (server: numeric taka),
// timestamps are ISO-8601 text, dates are 'YYYY-MM-DD' text, jsonb is JSON text.
// No foreign keys locally: pull can deliver a child row before its parent.

export type TransactionType = 'expense' | 'income' | 'transfer';
export type CategoryType = 'expense' | 'income';
export type { Frequency };

const nowIso = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

/** Columns every synced table carries. */
const syncColumns = {
  id: text('id').primaryKey(), // UUID generated on the device
  userId: text('user_id').notNull(),
  createdAt: text('created_at').notNull().default(nowIso),
  updatedAt: text('updated_at').notNull().default(nowIso), // set by the device on every edit (LWW)
  deletedAt: text('deleted_at'), // soft delete
  serverSeq: integer('server_seq'), // assigned by the server; null until pulled back
};

export const accounts = sqliteTable('accounts', {
  ...syncColumns,
  name: text('name').notNull(),
  initialBalance: integer('initial_balance').$type<Poisha>().notNull().default(sql`0`),
  icon: text('icon'),
  color: text('color'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
});

export const categories = sqliteTable('categories', {
  ...syncColumns,
  name: text('name').notNull(),
  type: text('type').$type<CategoryType>().notNull(),
  icon: text('icon'),
  color: text('color'),
  sortOrder: integer('sort_order').notNull().default(0),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
});

export const transactions = sqliteTable(
  'transactions',
  {
    ...syncColumns,
    accountId: text('account_id'),
    categoryId: text('category_id'),
    type: text('type').$type<TransactionType>().notNull(),
    amount: integer('amount').$type<Poisha>().notNull(),
    toAccountId: text('to_account_id'), // transfers only
    note: text('note'),
    occurredOn: text('occurred_on').notNull(), // 'YYYY-MM-DD'
    recurringId: text('recurring_id'),
  },
  (t) => [index('transactions_occurred_on_idx').on(t.occurredOn)],
);

export const budgets = sqliteTable('budgets', {
  ...syncColumns,
  categoryId: text('category_id'), // null = whole month
  month: text('month').notNull(), // first day of the month, 'YYYY-MM-01'
  amount: integer('amount').$type<Poisha>().notNull(),
});

export const recurringRules = sqliteTable('recurring_rules', {
  ...syncColumns,
  template: text('template', { mode: 'json' }).notNull(), // amount, category, account, note
  frequency: text('frequency').$type<Frequency>(),
  nextRun: text('next_run').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
});

// ---- Local-only tables (never synced) ----

export const outbox = sqliteTable(
  'outbox',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tableName: text('table_name').$type<SyncedTableName>().notNull(),
    rowId: text('row_id').notNull(),
    op: text('op').$type<'upsert' | 'delete'>().notNull(),
    payload: text('payload').notNull(), // JSON of the full row
    createdAt: integer('created_at').notNull(), // epoch ms
    attempts: integer('attempts').notNull().default(0),
  },
  // Pull skips rows that still have a pending outbox entry.
  (t) => [index('outbox_row_idx').on(t.tableName, t.rowId)],
);

export const syncState = sqliteTable('sync_state', {
  tableName: text('table_name').$type<SyncedTableName>().primaryKey(),
  lastSeq: integer('last_seq').notNull().default(0), // highest server_seq pulled so far
});

/** Device-only key/value settings, e.g. the signed-in user. */
export const localMeta = sqliteTable('local_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const syncedTables = {
  accounts,
  categories,
  transactions,
  budgets,
  recurring_rules: recurringRules,
} as const;

export type SyncedTableName = keyof typeof syncedTables;

export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type RecurringRule = typeof recurringRules.$inferSelect;
export type OutboxEntry = typeof outbox.$inferSelect;
