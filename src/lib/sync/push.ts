import { asc, inArray, sql } from 'drizzle-orm';

import { notifyChanged, type ChangedTable } from '@/lib/db/changes';
import { outbox, type OutboxEntry, type SyncedTableName } from '@/lib/db/schema';
import type { LocalDb } from '@/lib/db/types';

import { applyServerRows } from './apply';
import type { Change, SyncBackend } from './backend';
import { TABLE_ORDER, toServerRow, type LocalRow } from './mapping';

export const PUSH_BATCH_SIZE = 100;

/** Latest outbox entry per row, parents first. */
function collapse(entries: OutboxEntry[]): OutboxEntry[] {
  const latest = new Map<string, OutboxEntry>();
  for (const entry of entries) latest.set(`${entry.tableName}:${entry.rowId}`, entry);
  return [...latest.values()].sort(
    (a, b) => TABLE_ORDER.indexOf(a.tableName) - TABLE_ORDER.indexOf(b.tableName) || a.id - b.id,
  );
}

/**
 * Pushes the oldest batch of outbox entries. On success the batch is removed
 * and the server's rows are applied in the same local transaction, so a
 * crash can't leave the outbox cleared without the server's version stored.
 * Returns the number of outbox entries sent (0 when the outbox is empty).
 */
export async function pushBatch(db: LocalDb, backend: SyncBackend, batchSize = PUSH_BATCH_SIZE): Promise<number> {
  const batch = db.select().from(outbox).orderBy(asc(outbox.id)).limit(batchSize).all();
  if (batch.length === 0) return 0;
  const ids = batch.map((e) => e.id);

  const changes: Change[] = collapse(batch).map((e) => ({
    table: e.tableName,
    row: toServerRow(e.tableName, JSON.parse(e.payload) as LocalRow),
  }));

  let result;
  try {
    result = await backend.pushChanges(changes);
  } catch (error) {
    db.update(outbox).set({ attempts: sql`${outbox.attempts} + 1` }).where(inArray(outbox.id, ids)).run();
    notifyChanged('outbox');
    throw error;
  }

  const tables = Object.keys(result) as SyncedTableName[];
  db.transaction((tx) => {
    tx.delete(outbox).where(inArray(outbox.id, ids)).run();
    for (const table of tables) applyServerRows(tx, table, result[table] ?? []);
  });
  notifyChanged('outbox', ...(tables as ChangedTable[]));
  return batch.length;
}

/** Pushes until the outbox is empty. Stops at the first failed batch (it throws). */
export async function pushAll(db: LocalDb, backend: SyncBackend, batchSize = PUSH_BATCH_SIZE): Promise<void> {
  while ((await pushBatch(db, backend, batchSize)) > 0) {
    // keep going
  }
}
