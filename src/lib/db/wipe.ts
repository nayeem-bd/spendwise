import { notInArray } from 'drizzle-orm';

import { notifyChanged } from './changes';
import { localMeta, outbox, syncState, syncedTables } from './schema';
import type { LocalDb } from './types';

/** local_meta keys that belong to the device, not the user, and survive sign-out. */
export const DEVICE_META_KEYS = ['theme', 'appLock', 'reminder'];

/**
 * Logout: removes every local row (PROJECT_PLAN 5.1). This clears the
 * device's cache, not the user's data, which stays on the server. Callers
 * must warn first if the outbox is not empty. Device preferences are kept.
 */
export function wipeLocalData(db: LocalDb): void {
  db.transaction((tx) => {
    for (const table of [...Object.values(syncedTables), outbox, syncState]) {
      tx.delete(table).run();
    }
    tx.delete(localMeta).where(notInArray(localMeta.key, DEVICE_META_KEYS)).run();
  });
  notifyChanged(...(Object.keys(syncedTables) as (keyof typeof syncedTables)[]), 'outbox');
}
