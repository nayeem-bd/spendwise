import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseAsync } from 'expo-sqlite';
import { Platform } from 'react-native';

import * as schema from './schema';
import type { LocalDb } from './types';

export const DATABASE_NAME = 'spendwise.db';

const createDb = (expoDb: Parameters<typeof drizzle>[0]) => drizzle(expoDb, { schema });
export type Db = ReturnType<typeof createDb>;

let instance: Db | null = null;
let opening: Promise<Db> | null = null;

/**
 * Opens the local database once. Must be async: on web the first call has to
 * wait for the SQLite-WASM worker to load, and a sync open times out.
 * Drizzle's queries are sync, which is fine once the worker is running.
 */
export function openDb(): Promise<Db> {
  opening ??= (async () => {
    const expoDb = await openWithRetry();
    if (Platform.OS !== 'web') {
      await expoDb.execAsync('PRAGMA journal_mode = WAL;');
    }
    instance = createDb(expoDb);
    return instance;
  })();
  // Let a later call (e.g. a Retry button) try again after a failure.
  opening.catch(() => {
    opening = null;
  });
  return opening;
}

/** Web: another page or tab still holds the OPFS database file. */
export class DatabaseLockedError extends Error {}

const isLockError = (e: unknown) =>
  e instanceof Error && /NoModificationAllowed|Access Handles cannot be created/i.test(`${e.name} ${e.message}`);

/**
 * On web the database file can be locked for a moment while the previous
 * page's SQLite worker shuts down (reload, quick navigation), so retry
 * briefly. If it stays locked, another tab has the app open.
 */
async function openWithRetry(): Promise<Awaited<ReturnType<typeof openDatabaseAsync>>> {
  const deadline = Date.now() + 5000;
  for (let delay = 100; ; delay = Math.min(delay * 2, 1000)) {
    try {
      return await openDatabaseAsync(DATABASE_NAME);
    } catch (e) {
      if (!isLockError(e)) throw e;
      if (Date.now() + delay > deadline) {
        throw new DatabaseLockedError('SpendWise is already open in another tab. Close it, then reload this page.');
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/** The open database. Only valid inside <DatabaseGate>, which awaits openDb(). */
export function getDb(): LocalDb {
  if (!instance) throw new Error('Local database is not open yet; render inside <DatabaseGate>.');
  return instance;
}
