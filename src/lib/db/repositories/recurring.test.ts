import { pullAll } from '@/lib/sync/pull';
import { pushAll } from '@/lib/sync/push';
import { FakeServer } from '@/test/fakeServer';
import { createTestDb } from '@/test/testDb';
import type { Poisha } from '@/utils/money';

import { defaultRowId } from '../defaults';
import { outbox, transactions } from '../schema';
import { seedDefaults } from '../seed';
import type { LocalDb } from '../types';
import { listAccountsWithBalance } from './accounts';
import {
  createRecurring,
  deleteRecurring,
  getRecurring,
  materializeRecurring,
  occurrenceId,
  updateRecurring,
} from './recurring';
import { deleteTransaction, getTransaction, listTransactions } from './transactions';

const USER = '11111111-1111-1111-1111-111111111111';
const rent = defaultRowId(USER, 'category', 'house_rent');
const cash = defaultRowId(USER, 'account', 'cash');
const bank = defaultRowId(USER, 'account', 'bank');
const p = (n: number) => n as Poisha;

const newDevice = () => {
  const db = createTestDb();
  seedDefaults(db, USER);
  return db;
};
let db: LocalDb;
beforeEach(() => {
  db = newDevice();
});

const monthlyRent = (start = '2026-08-31', target: LocalDb = db) =>
  createRecurring(
    target,
    USER,
    { type: 'expense', amount: p(2500000), categoryId: rent, accountId: cash, note: 'Rent', occurredOn: start },
    'monthly',
  );

it('creates every due occurrence, clamping month ends, and moves next_run forward', () => {
  const rule = monthlyRent();
  expect(materializeRecurring(db, '2026-11-05')).toBe(3);
  expect(listTransactions(db).map((t) => t.occurredOn)).toEqual(['2026-10-31', '2026-09-30', '2026-08-31']);
  expect(listTransactions(db).every((t) => t.recurringId === rule.id && t.note === 'Rent')).toBe(true);
  expect(getRecurring(db, rule.id)?.nextRun).toBe('2026-11-30');
});

it('is idempotent', () => {
  monthlyRent();
  materializeRecurring(db, '2026-11-05');
  const outboxBefore = db.select().from(outbox).all().length;
  expect(materializeRecurring(db, '2026-11-05')).toBe(0);
  expect(listTransactions(db)).toHaveLength(3);
  expect(db.select().from(outbox).all()).toHaveLength(outboxBefore);
});

it('creates nothing before the start date', () => {
  monthlyRent('2026-12-01');
  expect(materializeRecurring(db, '2026-11-05')).toBe(0);
});

it('a paused rule creates nothing; a deleted rule keeps past occurrences', () => {
  const rule = monthlyRent();
  updateRecurring(db, rule.id, { active: false });
  expect(materializeRecurring(db, '2026-11-05')).toBe(0);

  updateRecurring(db, rule.id, { active: true });
  materializeRecurring(db, '2026-09-05');
  deleteRecurring(db, rule.id);
  expect(materializeRecurring(db, '2026-12-05')).toBe(0);
  expect(listTransactions(db)).toHaveLength(1);
});

it('edits change future occurrences only', () => {
  const rule = monthlyRent();
  materializeRecurring(db, '2026-08-31');
  updateRecurring(db, rule.id, { amount: p(2700000) });
  materializeRecurring(db, '2026-09-30');
  expect(listTransactions(db).map((t) => [t.occurredOn, t.amount])).toEqual([
    ['2026-09-30', 2700000],
    ['2026-08-31', 2500000],
  ]);
});

it('recurring transfers move money between accounts', () => {
  createRecurring(
    db,
    USER,
    { type: 'transfer', amount: p(100000), accountId: bank, toAccountId: cash, note: null, occurredOn: '2026-10-01' },
    'weekly',
  );
  materializeRecurring(db, '2026-10-20'); // Oct 1, 8, 15
  const balances = Object.fromEntries(listAccountsWithBalance(db).map((a) => [a.name, a.balance]));
  expect(balances).toMatchObject({ Bank: -300000, Cash: 300000 });
});

it('rejects invalid templates', () => {
  expect(() =>
    createRecurring(db, USER, { type: 'expense', amount: p(0), categoryId: rent, accountId: cash, note: null, occurredOn: '2026-10-01' }, 'monthly'),
  ).toThrow('Enter an amount above ৳0');
});

describe('with two devices', () => {
  let server: FakeServer;
  let phoneB: LocalDb;
  const sync = async (d: LocalDb) => {
    await pushAll(d, server.backend());
    await pullAll(d, server.backend());
  };

  beforeEach(() => {
    server = new FakeServer();
    phoneB = newDevice();
  });

  it('both generating the same occurrences creates no duplicates', async () => {
    const rule = monthlyRent();
    await sync(db);
    await sync(phoneB); // B gets the rule

    materializeRecurring(db, '2026-10-05');
    materializeRecurring(phoneB, '2026-10-05');
    await sync(db);
    await sync(phoneB);
    await sync(db);

    expect(server.rows('transactions')).toHaveLength(2);
    expect(listTransactions(db)).toHaveLength(2);
    expect(listTransactions(phoneB)).toHaveLength(2);
    expect(getTransaction(phoneB, occurrenceId(rule.id, '2026-09-30'))).toBeDefined();
  });

  it('an occurrence deleted on A is not brought back by B regenerating it', async () => {
    const rule = monthlyRent();
    await sync(db);
    await sync(phoneB);

    materializeRecurring(db, '2026-09-05'); // creates Aug 31
    deleteTransaction(db, occurrenceId(rule.id, '2026-08-31'));
    await sync(db);

    materializeRecurring(phoneB, '2026-09-05'); // B hasn't pulled the delete yet
    await sync(phoneB);
    await sync(db);

    expect(server.rows('transactions')[0]?.deleted_at).not.toBeNull();
    expect(listTransactions(phoneB)).toHaveLength(0);
    expect(listTransactions(db)).toHaveLength(0);
  });
});

it('generated rows use the occurrence date as their timestamps', () => {
  const rule = monthlyRent();
  materializeRecurring(db, '2026-09-01');
  const row = db.select().from(transactions).all()[0];
  expect(row).toMatchObject({ id: occurrenceId(rule.id, '2026-08-31'), createdAt: '2026-08-31T00:00:00.000Z', updatedAt: '2026-08-31T00:00:00.000Z' });
});
