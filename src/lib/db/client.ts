import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseAsync } from 'expo-sqlite';
import { Platform } from 'react-native';

import * as schema from './schema';

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
    const expoDb = await openDatabaseAsync(DATABASE_NAME);
    if (Platform.OS !== 'web') {
      await expoDb.execAsync('PRAGMA journal_mode = WAL;');
    }
    instance = createDb(expoDb);
    return instance;
  })();
  return opening;
}

/** The open database. Only valid inside <DatabaseGate>, which awaits openDb(). */
export function getDb(): Db {
  if (!instance) throw new Error('Local database is not open yet; render inside <DatabaseGate>.');
  return instance;
}
