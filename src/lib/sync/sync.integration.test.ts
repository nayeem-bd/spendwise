// Real sync against a local Supabase (`npm run test:integration`, plain-Node jest config).
// Skipped when SUPABASE_TEST_URL / SUPABASE_TEST_ANON_KEY aren't set.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { defaultRowId } from '@/lib/db/defaults';
import { listCategories } from '@/lib/db/repositories/categories';
import { createRecurring, getRecurring, materializeRecurring } from '@/lib/db/repositories/recurring';
import { budgetStatuses, setBudget } from '@/lib/db/repositories/budgets';
import { deleteTransaction, getTransaction, listTransactions, saveTransaction, type EntryInput } from '@/lib/db/repositories/transactions';
import { seedDefaults } from '@/lib/db/seed';
import type { LocalDb } from '@/lib/db/types';
import { createTestDb } from '@/test/testDb';
import type { Poisha } from '@/utils/money';

import type { SyncBackend } from './backend';
import { pullAll } from './pull';
import { pushAll } from './push';
import { supabaseBackend } from './supabaseBackend';

const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const describeIf = url && anonKey ? describe : describe.skip;

type Device = { db: LocalDb; backend: SyncBackend; client: SupabaseClient<Database>; userId: string };

async function signUpUser(): Promise<{ email: string; password: string; userId: string }> {
  const email = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@spendwise.test`;
  const password = 'integration-test-pw';
  const client = createClient<Database>(url!, anonKey!, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signUp({ email, password });
  if (error || !data.user) throw error ?? new Error('signUp returned no user');
  return { email, password, userId: data.user.id };
}

async function device(user: { email: string; password: string; userId: string }): Promise<Device> {
  const client = createClient<Database>(url!, anonKey!, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  const db = createTestDb();
  seedDefaults(db, user.userId);
  return { db, client, backend: supabaseBackend(client), userId: user.userId };
}

const sync = async (d: Device) => {
  await pushAll(d.db, d.backend);
  await pullAll(d.db, d.backend);
};

const expense = (userId: string, overrides: Partial<EntryInput> = {}): EntryInput => ({
  type: 'expense',
  amount: 25050 as Poisha,
  categoryId: defaultRowId(userId, 'category', 'food'),
  accountId: defaultRowId(userId, 'account', 'cash'),
  note: null,
  occurredOn: '2026-10-03',
  ...overrides,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describeIf('sync against local Supabase', () => {
  let user: Awaited<ReturnType<typeof signUpUser>>;
  let phoneA: Device;
  let phoneB: Device;

  beforeAll(async () => {
    user = await signUpUser();
    phoneA = await device(user);
    phoneB = await device(user);
  });

  it('device-seeded defaults match the server seed (no duplicates after pull)', async () => {
    await sync(phoneA);
    expect(listCategories(phoneA.db)).toHaveLength(16);
  });

  it('pushes offline expenses and the other device pulls them', async () => {
    for (let i = 1; i <= 10; i++) saveTransaction(phoneA.db, user.userId, expense(user.userId, { amount: (i * 1050) as Poisha }));
    await sync(phoneA);
    await sync(phoneB);
    const amounts = listTransactions(phoneB.db).map((t) => t.amount).sort((a, b) => a - b);
    expect(amounts).toEqual([1050, 2100, 3150, 4200, 5250, 6300, 7350, 8400, 9450, 10500]);
  });

  it('newer edit wins and deletes propagate', async () => {
    const { id } = saveTransaction(phoneA.db, user.userId, expense(user.userId, { note: 'v1' }));
    await sync(phoneA);
    await sync(phoneB);

    saveTransaction(phoneA.db, user.userId, expense(user.userId, { note: 'older' }), id);
    await sleep(5);
    saveTransaction(phoneB.db, user.userId, expense(user.userId, { note: 'newer' }), id);
    await sync(phoneB);
    await sync(phoneA);
    expect(getTransaction(phoneA.db, id)?.note).toBe('newer');

    deleteTransaction(phoneA.db, id);
    await sync(phoneA);
    await sync(phoneB);
    expect(getTransaction(phoneB.db, id)?.deletedAt).not.toBeNull();
  });

  it('recurring rules (JSON template), their occurrences and budgets round-trip', async () => {
    const rule = createRecurring(
      phoneA.db,
      user.userId,
      expense(user.userId, { amount: 2500050 as Poisha, note: 'Rent', occurredOn: '2026-08-31' }),
      'monthly',
    );
    materializeRecurring(phoneA.db, '2026-10-05');
    setBudget(phoneA.db, user.userId, { categoryId: null, month: '2026-10', amount: 9000000 as Poisha });
    await sync(phoneA);
    await sync(phoneB);

    expect(getRecurring(phoneB.db, rule.id)).toMatchObject({
      nextRun: '2026-10-31',
      template: { amount: 2500050, note: 'Rent', anchorDay: 31 },
    });
    expect(listTransactions(phoneB.db).filter((t) => t.recurringId === rule.id).map((t) => t.occurredOn)).toEqual([
      '2026-09-30',
      '2026-08-31',
    ]);
    expect(budgetStatuses(phoneB.db, '2026-10').total?.amount).toBe(9000000);
  });

  it('another user sees none of it', async () => {
    const other = await device(await signUpUser());
    await sync(other);
    expect(listTransactions(other.db)).toHaveLength(0);
    expect(listCategories(other.db)).toHaveLength(16); // only their own defaults
  });
});
