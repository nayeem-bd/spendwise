import { eq } from 'drizzle-orm';

import { localMeta } from './schema';
import type { LocalDb } from './types';

export function getMeta(db: LocalDb, key: string): string | undefined {
  return db.select().from(localMeta).where(eq(localMeta.key, key)).get()?.value;
}

export function setMeta(db: LocalDb, key: string, value: string): void {
  db.insert(localMeta).values({ key, value }).onConflictDoUpdate({ target: localMeta.key, set: { value } }).run();
}
