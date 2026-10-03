import { and, asc, eq, isNull, lte } from 'drizzle-orm';

import { nextOccurrence, type Frequency } from '@/utils/date';
import type { Poisha } from '@/utils/money';

import { newId } from '../id';
import { accounts, categories, recurringRules, transactions, type RecurringRule, type TransactionType } from '../schema';
import type { LocalDb } from '../types';
import { uuidv5 } from '../uuidv5';
import { insertRowIfAbsent, patchRow, softDeleteRow, upsertRow } from '../write';
import { validateTransaction, type TransactionInput } from './transactions';
import { ValidationError } from './validate';

// Recurring transactions are created on the device, not by a server job:
// each occurrence's id is UUIDv5(rule.id, 'occurrence:<date>'), so every
// device creates the same row and they merge instead of duplicating. It works
// offline and needs no Edge Function / pg_cron.
//
// Generated rows get created_at = updated_at = the occurrence date (not now).
// If the user edited or deleted an occurrence, that change has a later
// updated_at, so a device that regenerates the row before pulling the change
// loses last-write-wins instead of resurrecting it.

/** Stored in recurring_rules.template (JSON). Amounts are poisha. */
export type RecurringTemplate = {
  type: TransactionType;
  amount: Poisha;
  accountId: string;
  categoryId: string | null;
  toAccountId: string | null;
  note: string | null;
  /** Day of month the rule started on; monthly/yearly occurrences keep it. */
  anchorDay: number;
};

export type RecurringListItem = RecurringRule & {
  template: RecurringTemplate;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  accountName: string | null;
  toAccountName: string | null;
};

export const FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly', 'yearly'];
const MAX_OCCURRENCES_PER_RUN = 400; // a daily rule left for over a year catches up over a few runs

export const occurrenceId = (ruleId: string, date: string) => uuidv5(`occurrence:${date}`, ruleId);

function asTemplate(value: unknown): RecurringTemplate {
  const t = value as Partial<RecurringTemplate> | null;
  if (!t || typeof t.amount !== 'number' || typeof t.accountId !== 'string' || typeof t.type !== 'string') {
    throw new Error('Invalid recurring template');
  }
  return {
    type: t.type,
    amount: t.amount,
    accountId: t.accountId,
    categoryId: t.categoryId ?? null,
    toAccountId: t.toAccountId ?? null,
    note: t.note ?? null,
    anchorDay: t.anchorDay ?? 1,
  };
}

/** Creates a rule whose first occurrence is input.occurredOn. Call materializeRecurring afterwards. */
export function createRecurring(db: LocalDb, userId: string, input: TransactionInput, frequency: Frequency): RecurringRule {
  if (!FREQUENCIES.includes(frequency)) throw new ValidationError('Invalid frequency');
  const { occurredOn, ...valid } = validateTransaction(input);
  const template: RecurringTemplate = { ...valid, anchorDay: Number(occurredOn.slice(8, 10)) };
  return upsertRow(db, recurringRules, { id: newId(), userId, template, frequency, nextRun: occurredOn, active: true });
}

/** Changes what future occurrences look like. Past ones are left as they are. */
export function updateRecurring(
  db: LocalDb,
  id: string,
  changes: { amount?: Poisha; note?: string | null; frequency?: Frequency; active?: boolean },
): RecurringRule {
  const rule = db.select().from(recurringRules).where(eq(recurringRules.id, id)).get();
  if (!rule || rule.deletedAt) throw new ValidationError('This repeating transaction no longer exists');
  const template = asTemplate(rule.template);
  if (changes.amount !== undefined) {
    if (!Number.isSafeInteger(changes.amount) || changes.amount <= 0) throw new ValidationError('Enter an amount above ৳0');
    template.amount = changes.amount;
  }
  if (changes.note !== undefined) template.note = changes.note?.trim() || null;
  if (changes.frequency !== undefined && !FREQUENCIES.includes(changes.frequency)) throw new ValidationError('Invalid frequency');
  return patchRow(db, recurringRules, id, {
    template,
    ...(changes.frequency !== undefined && { frequency: changes.frequency }),
    ...(changes.active !== undefined && { active: changes.active }),
  });
}

/** Stops the rule. Transactions it already created stay. */
export function deleteRecurring(db: LocalDb, id: string): void {
  softDeleteRow(db, recurringRules, id);
}

/**
 * Creates every occurrence due up to `today` for active rules and moves each
 * rule's next_run forward. Safe to run repeatedly and on several devices.
 * Returns the number of transactions created.
 */
export function materializeRecurring(db: LocalDb, today: string): number {
  const due = db
    .select()
    .from(recurringRules)
    .where(and(isNull(recurringRules.deletedAt), eq(recurringRules.active, true), lte(recurringRules.nextRun, today)))
    .all();

  let created = 0;
  for (const rule of due) {
    const template = asTemplate(rule.template);
    const frequency = rule.frequency ?? 'monthly';
    let date = rule.nextRun;
    for (let n = 0; date <= today && n < MAX_OCCURRENCES_PER_RUN; n++) {
      const stamp = `${date}T00:00:00.000Z`;
      const inserted = insertRowIfAbsent(db, transactions, {
        id: occurrenceId(rule.id, date),
        userId: rule.userId,
        type: template.type,
        amount: template.amount,
        accountId: template.accountId,
        categoryId: template.categoryId,
        toAccountId: template.toAccountId,
        note: template.note,
        occurredOn: date,
        recurringId: rule.id,
        createdAt: stamp,
        updatedAt: stamp,
      });
      if (inserted) created++;
      date = nextOccurrence(date, frequency, template.anchorDay);
    }
    if (date !== rule.nextRun) patchRow(db, recurringRules, rule.id, { nextRun: date });
  }
  return created;
}

export function listRecurring(db: LocalDb): RecurringListItem[] {
  const rules = db
    .select()
    .from(recurringRules)
    .where(isNull(recurringRules.deletedAt))
    .orderBy(asc(recurringRules.nextRun))
    .all();
  const categoryById = new Map(db.select().from(categories).all().map((c) => [c.id, c]));
  const accountName = new Map(db.select({ id: accounts.id, name: accounts.name }).from(accounts).all().map((a) => [a.id, a.name]));
  return rules.map((rule) => {
    const template = asTemplate(rule.template);
    const category = template.categoryId ? categoryById.get(template.categoryId) : undefined;
    return {
      ...rule,
      template,
      categoryName: category?.name ?? null,
      categoryIcon: category?.icon ?? null,
      categoryColor: category?.color ?? null,
      accountName: accountName.get(template.accountId) ?? null,
      toAccountName: template.toAccountId ? (accountName.get(template.toAccountId) ?? null) : null,
    };
  });
}

export function getRecurring(db: LocalDb, id: string): RecurringListItem | undefined {
  return listRecurring(db).find((r) => r.id === id);
}
