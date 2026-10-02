import { eq } from 'drizzle-orm';

import { outbox, syncedTables, type SyncedTableName } from '@/lib/db/schema';
import type { LocalDb } from '@/lib/db/types';

import { fromServerRow, type ServerRow } from './mapping';

/**
 * Writes server rows into the local DB without queueing them for sync.
 * Rows that still have a pending outbox entry are skipped: that local edit
 * is newer and will be pushed next. Call inside a transaction.
 */
export function applyServerRows(tx: LocalDb, table: SyncedTableName, rows: readonly ServerRow[]): void {
  if (rows.length === 0) return;
  const target = syncedTables[table];
  const pending = new Set(
    tx.select({ rowId: outbox.rowId }).from(outbox).where(eq(outbox.tableName, table)).all().map((r) => r.rowId),
  );
  for (const serverRow of rows) {
    const row = fromServerRow(table, serverRow);
    if (pending.has(row.id)) continue;
    const { id: _id, ...fields } = row;
    // The mapped row has exactly this table's columns; Drizzle can't type a row built from column metadata.
    const values = row as typeof target.$inferInsert;
    tx.insert(target).values(values).onConflictDoUpdate({ target: target.id, set: fields }).run();
  }
}
