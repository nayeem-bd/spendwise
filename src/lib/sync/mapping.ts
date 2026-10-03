import { getTableColumns } from 'drizzle-orm';

import { syncedTables, type SyncedTableName } from '@/lib/db/schema';

// Local rows: camelCase keys, money in integer poisha, ISO timestamps.
// Server rows: snake_case column names, money as numeric taka.

export type ServerRow = Record<string, unknown> & { id: string; server_seq?: number | null };
export type LocalRow = Record<string, unknown> & { id: string };

const MONEY_COLUMNS: Record<SyncedTableName, readonly string[]> = {
  accounts: ['initialBalance'],
  categories: [],
  transactions: ['amount'],
  budgets: ['amount'],
  recurring_rules: [],
  attachments: [],
  account_members: [],
};

const TIMESTAMP_COLUMNS = new Set(['createdAt', 'updatedAt', 'deletedAt']);

/** Parents before children, so foreign keys hold within one push. */
export const TABLE_ORDER: readonly SyncedTableName[] = [
  'accounts',
  'account_members',
  'categories',
  'recurring_rules',
  'transactions',
  'budgets',
  'attachments',
];

/** 25050 → "250.50". A string, so Postgres numeric gets the exact value. */
export function poishaToTakaString(poisha: number): string {
  const sign = poisha < 0 ? '-' : '';
  const abs = Math.abs(poisha);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Server numeric (number or string) → integer poisha. */
export function takaToPoisha(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  if (!Number.isFinite(n)) throw new Error(`Invalid money value from server: ${String(value)}`);
  return Math.round(n * 100);
}

export function toServerRow(table: SyncedTableName, local: LocalRow): ServerRow {
  const out: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(getTableColumns(syncedTables[table]))) {
    if (key === 'serverSeq') continue; // server-assigned
    let value = local[key] ?? null;
    if (value !== null && MONEY_COLUMNS[table].includes(key)) value = poishaToTakaString(value as number);
    out[column.name] = value;
  }
  return out as ServerRow;
}

export function fromServerRow(table: SyncedTableName, server: ServerRow): LocalRow {
  const out: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(getTableColumns(syncedTables[table]))) {
    let value = server[column.name] ?? null;
    if (value !== null && MONEY_COLUMNS[table].includes(key)) value = takaToPoisha(value);
    else if (value !== null && TIMESTAMP_COLUMNS.has(key)) value = new Date(value as string).toISOString();
    else if (value !== null && key === 'serverSeq') value = Number(value);
    out[key] = value;
  }
  return out as LocalRow;
}
