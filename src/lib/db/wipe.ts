import { notifyChanged } from './changes';
import { localMeta, outbox, syncState, syncedTables } from './schema';
import type { LocalDb } from './types';

/**
 * Logout: removes every local row (PROJECT_PLAN 5.1). This clears the
 * device's cache, not the user's data, which stays on the server. Callers
 * must warn first if the outbox is not empty.
 */
export function wipeLocalData(db: LocalDb): void {
  db.transaction((tx) => {
    for (const table of [...Object.values(syncedTables), outbox, syncState, localMeta]) {
      tx.delete(table).run();
    }
  });
  notifyChanged(...(Object.keys(syncedTables) as (keyof typeof syncedTables)[]), 'outbox');
}
