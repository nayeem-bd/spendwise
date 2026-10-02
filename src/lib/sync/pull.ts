import { eq } from 'drizzle-orm';

import { notifyChanged } from '@/lib/db/changes';
import { syncState, type SyncedTableName } from '@/lib/db/schema';
import type { LocalDb } from '@/lib/db/types';

import { applyServerRows } from './apply';
import type { SyncBackend } from './backend';
import { TABLE_ORDER } from './mapping';

export const PULL_PAGE_SIZE = 500;

export function getLastSeq(db: LocalDb, table: SyncedTableName): number {
  return db.select().from(syncState).where(eq(syncState.tableName, table)).get()?.lastSeq ?? 0;
}

/**
 * Fetches rows changed since the last pull (by server_seq, never by device
 * clock) for every table and applies them. A new device starts at 0 and
 * downloads everything.
 */
export async function pullAll(db: LocalDb, backend: SyncBackend, pageSize = PULL_PAGE_SIZE): Promise<void> {
  for (const table of TABLE_ORDER) {
    let since = getLastSeq(db, table);
    for (;;) {
      const rows = await backend.pullChanges(table, since, pageSize);
      if (rows.length === 0) break;
      const maxSeq = Math.max(...rows.map((r) => Number(r.server_seq)));
      db.transaction((tx) => {
        applyServerRows(tx, table, rows);
        tx.insert(syncState)
          .values({ tableName: table, lastSeq: maxSeq })
          .onConflictDoUpdate({ target: syncState.tableName, set: { lastSeq: maxSeq } })
          .run();
      });
      notifyChanged(table);
      since = maxSeq;
      if (rows.length < pageSize) break;
    }
  }
}
