import { notifyChanged } from './changes';
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, defaultRowId } from './defaults';
import { accounts, categories } from './schema';
import type { LocalDb } from './types';

/**
 * Creates the default accounts and categories locally so a new device works
 * before its first sync. Not queued in the outbox: the server already seeds
 * the same rows (same ids) on sign-up, and a later pull overwrites these.
 * Existing rows (pulled, edited or deleted) are left alone.
 */
export function seedDefaults(db: LocalDb, userId: string): void {
  db.transaction((tx) => {
    tx.insert(accounts)
      .values(
        DEFAULT_ACCOUNTS.map((a) => ({
          id: defaultRowId(userId, 'account', a.key),
          userId,
          name: a.name,
          icon: a.icon,
          color: a.color,
        })),
      )
      .onConflictDoNothing()
      .run();
    tx.insert(categories)
      .values(
        DEFAULT_CATEGORIES.map((c) => ({
          id: defaultRowId(userId, 'category', c.key),
          userId,
          name: c.name,
          type: c.type,
          icon: c.icon,
          color: c.color,
          sortOrder: c.sortOrder,
        })),
      )
      .onConflictDoNothing()
      .run();
  });
  notifyChanged('accounts', 'categories');
}
