import { eq, getTableName } from 'drizzle-orm';

import { notifyChanged } from './changes';
import { outbox, syncedTables, type SyncedTableName } from './schema';
import type { LocalDb } from './types';

// The only way the app writes synced rows. Each write is one SQLite
// transaction: upsert the row + insert an outbox entry with the full row.
// Deletes are soft (deleted_at). Outbox payloads use the local row shape
// (camelCase keys, poisha); the sync layer maps them to the server shape.

type SyncedTable = (typeof syncedTables)[SyncedTableName];
export type RowOf<T extends SyncedTable> = T['$inferSelect'];
export type NewRowOf<T extends SyncedTable> = Omit<T['$inferInsert'], 'createdAt' | 'updatedAt' | 'deletedAt' | 'serverSeq'>;

const nowIso = () => new Date().toISOString();

function tableNameOf(table: SyncedTable): SyncedTableName {
  return getTableName(table) as SyncedTableName;
}

function enqueue(tx: LocalDb, tableName: SyncedTableName, row: { id: string }, op: 'upsert' | 'delete') {
  tx.insert(outbox)
    .values({ tableName, rowId: row.id, op, payload: JSON.stringify(row), createdAt: Date.now() })
    .run();
}

function selectById<T extends SyncedTable>(tx: LocalDb, table: T, id: string): RowOf<T> | undefined {
  // Drizzle can't narrow select() over a generic table; the row type is T's select model.
  return tx.select().from(table as SyncedTable).where(eq(table.id, id)).get() as RowOf<T> | undefined;
}

/** Inserts or replaces a row (all fields) and queues it for sync. */
export function upsertRow<T extends SyncedTable>(db: LocalDb, table: T, values: NewRowOf<T>): RowOf<T> {
  const name = tableNameOf(table);
  const updatedAt = nowIso();
  const row = db.transaction((tx) => {
    const { id: _id, ...fields } = values as NewRowOf<SyncedTable>;
    tx.insert(table as SyncedTable)
      .values({ ...(values as NewRowOf<SyncedTable>), updatedAt, deletedAt: null })
      .onConflictDoUpdate({ target: table.id, set: { ...fields, updatedAt, deletedAt: null } })
      .run();
    const saved = selectById(tx, table, values.id);
    if (!saved) throw new Error(`${name} ${values.id} missing after upsert`);
    enqueue(tx, name, saved, 'upsert');
    return saved;
  });
  notifyChanged(name, 'outbox');
  return row;
}

/** Updates some fields of an existing, non-deleted row and queues it for sync. */
export function patchRow<T extends SyncedTable>(
  db: LocalDb,
  table: T,
  id: string,
  patch: Partial<Omit<NewRowOf<T>, 'id' | 'userId'>>,
): RowOf<T> {
  const name = tableNameOf(table);
  const row = db.transaction((tx) => {
    const existing = selectById(tx, table, id);
    if (!existing || existing.deletedAt) throw new Error(`${name} ${id} not found`);
    tx.update(table as SyncedTable)
      .set({ ...patch, updatedAt: nowIso() })
      .where(eq(table.id, id))
      .run();
    const saved = selectById(tx, table, id)!;
    enqueue(tx, name, saved, 'upsert');
    return saved;
  });
  notifyChanged(name, 'outbox');
  return row;
}

/** Soft-deletes a row (sets deleted_at) and queues the delete for sync. */
export function softDeleteRow<T extends SyncedTable>(db: LocalDb, table: T, id: string): void {
  const name = tableNameOf(table);
  db.transaction((tx) => {
    const existing = selectById(tx, table, id);
    if (!existing || existing.deletedAt) return;
    const now = nowIso();
    tx.update(table as SyncedTable)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(table.id, id))
      .run();
    enqueue(tx, name, selectById(tx, table, id)!, 'delete');
  });
  notifyChanged(name, 'outbox');
}

/**
 * Inserts a row with explicit timestamps only if no row with its id exists
 * (deleted rows count as existing), and queues it for sync when inserted.
 * Returns whether it was inserted. Used for generated rows (recurring
 * occurrences) that several devices may create with the same id.
 */
export function insertRowIfAbsent<T extends SyncedTable>(
  db: LocalDb,
  table: T,
  values: NewRowOf<T> & { createdAt: string; updatedAt: string },
): boolean {
  const name = tableNameOf(table);
  const inserted = db.transaction((tx) => {
    if (selectById(tx, table, values.id)) return false;
    tx.insert(table as SyncedTable).values({ ...(values as NewRowOf<SyncedTable>), deletedAt: null }).run();
    enqueue(tx, name, selectById(tx, table, values.id)!, 'upsert');
    return true;
  });
  if (inserted) notifyChanged(name, 'outbox');
  return inserted;
}
