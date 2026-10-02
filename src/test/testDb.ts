/// <reference types="node" />
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { join } from 'path';

import * as schema from '@/lib/db/schema';
import type { LocalDb } from '@/lib/db/types';

/** In-memory SQLite with the app's real local migrations applied. */
export function createTestDb(): LocalDb {
  const db = drizzle(new Database(':memory:'), { schema });
  migrate(db, { migrationsFolder: join(__dirname, '../lib/db/migrations') });
  return db;
}
