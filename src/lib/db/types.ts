import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * Any synchronous Drizzle SQLite database with our schema: expo-sqlite in the
 * app, better-sqlite3 in tests. Repositories take this so they can be tested
 * in Node.
 */
export type LocalDb = BaseSQLiteDatabase<'sync', unknown, typeof schema>;
