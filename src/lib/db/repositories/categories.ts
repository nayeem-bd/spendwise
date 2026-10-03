import { and, asc, eq, isNull, max } from 'drizzle-orm';

import { newId } from '../id';
import { categories, type Category, type CategoryType } from '../schema';
import type { LocalDb } from '../types';
import { patchRow, softDeleteRow, upsertRow } from '../write';
import { requireName } from './validate';

export type CategoryInput = { name: string; type: CategoryType; icon: string; color: string };

const notDeleted = isNull(categories.deletedAt);

/**
 * Active categories, optionally of one type. Pass `ownerId` for pickers and
 * management: with a shared wallet, co-members' categories are on this
 * device too (to label their transactions) but aren't yours to use.
 */
export function listCategories(db: LocalDb, type?: CategoryType, ownerId?: string): Category[] {
  return db
    .select()
    .from(categories)
    .where(
      and(
        notDeleted,
        eq(categories.archived, false),
        type ? eq(categories.type, type) : undefined,
        ownerId ? eq(categories.userId, ownerId) : undefined,
      ),
    )
    .orderBy(asc(categories.type), asc(categories.sortOrder), asc(categories.name))
    .all();
}

export function getCategory(db: LocalDb, id: string): Category | undefined {
  return db.select().from(categories).where(eq(categories.id, id)).get();
}

export function createCategory(db: LocalDb, userId: string, input: CategoryInput): Category {
  const last = db
    .select({ value: max(categories.sortOrder) })
    .from(categories)
    .where(and(notDeleted, eq(categories.type, input.type)))
    .get();
  return upsertRow(db, categories, {
    id: newId(),
    userId,
    name: requireName(input.name),
    type: input.type,
    icon: input.icon,
    color: input.color,
    sortOrder: (last?.value ?? -1) + 1,
    archived: false,
  });
}

export function updateCategory(db: LocalDb, id: string, input: Partial<CategoryInput>): Category {
  return patchRow(db, categories, id, {
    ...input,
    ...(input.name !== undefined && { name: requireName(input.name) }),
  });
}

/** Soft delete. Transactions keep the category id and still show its name. */
export function deleteCategory(db: LocalDb, id: string): void {
  softDeleteRow(db, categories, id);
}
