import { defaultRowId } from '@/lib/db/defaults';
import { createCategory } from '@/lib/db/repositories/categories';
import { deleteTransaction, getTransaction, listTransactions, saveTransaction, type TransactionInput } from '@/lib/db/repositories/transactions';
import { outbox } from '@/lib/db/schema';
import { seedDefaults } from '@/lib/db/seed';
import type { LocalDb } from '@/lib/db/types';
import { FakeServer } from '@/test/fakeServer';
import { createTestDb } from '@/test/testDb';
import type { Poisha } from '@/utils/money';

import { pullAll } from './pull';
import { pushAll } from './push';

// The sync test checklist from PROJECT_PLAN.md section 5.1, with two devices
// (two local DBs) sharing one fake server.

const USER = '11111111-1111-1111-1111-111111111111';
const p = (n: number) => n as Poisha;

let server: FakeServer;
let phoneA: LocalDb;
let phoneB: LocalDb;

const newDevice = () => {
  const db = createTestDb();
  seedDefaults(db, USER);
  return db;
};
const sync = async (db: LocalDb) => {
  await pushAll(db, server.backend());
  await pullAll(db, server.backend());
};
const expense = (overrides: Partial<TransactionInput> = {}): TransactionInput => ({
  type: 'expense',
  amount: p(10000),
  categoryId: defaultRowId(USER, 'category', 'food'),
  accountId: defaultRowId(USER, 'account', 'cash'),
  note: null,
  occurredOn: '2026-10-03',
  ...overrides,
});
const outboxCount = (db: LocalDb) => db.select().from(outbox).all().length;

let clock = Date.parse('2026-10-03T10:00:00Z');
const tick = (ms = 1000) => {
  clock += ms;
  jest.setSystemTime(clock);
};

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  tick();
  server = new FakeServer();
  phoneA = newDevice();
  phoneB = newDevice();
});
afterEach(() => jest.useRealTimers());

it('10 expenses added offline all reach the server', async () => {
  for (let i = 1; i <= 10; i++) saveTransaction(phoneA, USER, expense({ amount: p(i * 100) }));
  expect(outboxCount(phoneA)).toBe(10);

  await sync(phoneA);

  expect(server.rows('transactions')).toHaveLength(10);
  expect(outboxCount(phoneA)).toBe(0);
  expect(listTransactions(phoneA).every((t) => t.serverSeq !== null)).toBe(true);
  expect(server.rows('transactions').map((r) => r.amount).sort((a, b) => Number(a) - Number(b))).toEqual(
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
});

it('the other device receives them on pull', async () => {
  saveTransaction(phoneA, USER, expense({ note: 'from A' }));
  await sync(phoneA);
  await sync(phoneB);
  expect(listTransactions(phoneB).map((t) => t.note)).toEqual(['from A']);
  expect(listTransactions(phoneB)[0]?.amount).toBe(10000);
});

describe('same transaction edited on both phones offline: the newer edit wins', () => {
  let id: string;
  beforeEach(async () => {
    id = saveTransaction(phoneA, USER, expense()).id;
    await sync(phoneA);
    await sync(phoneB);
    tick();
    saveTransaction(phoneA, USER, expense({ note: 'older edit on A' }), id);
    tick();
    saveTransaction(phoneB, USER, expense({ note: 'newer edit on B' }), id);
  });

  it('when the older edit syncs first', async () => {
    await sync(phoneA);
    await sync(phoneB);
    await sync(phoneA);
    expect(getTransaction(phoneA, id)?.note).toBe('newer edit on B');
    expect(getTransaction(phoneB, id)?.note).toBe('newer edit on B');
  });

  it('when the newer edit syncs first, the older push gets the winner back', async () => {
    await sync(phoneB);
    await pushAll(phoneA, server.backend()); // push only: A must not keep its losing edit
    expect(getTransaction(phoneA, id)?.note).toBe('newer edit on B');
    expect(server.rows('transactions')[0]?.note).toBe('newer edit on B');
  });

  it('when A pulls past B’s edit before its own push loses', async () => {
    await sync(phoneB);
    await pullAll(phoneA, server.backend()); // skips the row: A's edit is pending
    expect(getTransaction(phoneA, id)?.note).toBe('older edit on A');
    await pushAll(phoneA, server.backend());
    expect(getTransaction(phoneA, id)?.note).toBe('newer edit on B');
  });
});

it('a delete on phone A disappears on phone B', async () => {
  const { id } = saveTransaction(phoneA, USER, expense());
  await sync(phoneA);
  await sync(phoneB);
  expect(listTransactions(phoneB)).toHaveLength(1);

  tick();
  deleteTransaction(phoneA, id);
  await sync(phoneA);
  await sync(phoneB);

  expect(listTransactions(phoneB)).toHaveLength(0);
  expect(getTransaction(phoneB, id)?.deletedAt).not.toBeNull();
});

it('app killed mid-sync: no duplicates or lost data', async () => {
  saveTransaction(phoneA, USER, expense({ note: 'one' }));
  saveTransaction(phoneA, USER, expense({ note: 'two' }));

  server.failNextPushAfterCommit = true;
  await expect(pushAll(phoneA, server.backend())).rejects.toThrow('connection lost after commit');
  expect(outboxCount(phoneA)).toBe(2); // the device never heard back

  await sync(phoneA);
  expect(server.rows('transactions')).toHaveLength(2);
  expect(listTransactions(phoneA)).toHaveLength(2);
  expect(outboxCount(phoneA)).toBe(0);
});

it('a failed push keeps the outbox and counts the attempt', async () => {
  saveTransaction(phoneA, USER, expense());
  server.failNextPush = true;
  await expect(pushAll(phoneA, server.backend())).rejects.toThrow('network down');
  expect(phoneA.select().from(outbox).all().map((e) => e.attempts)).toEqual([1]);
  await sync(phoneA);
  expect(server.rows('transactions')).toHaveLength(1);
});

it('reinstall downloads the full history', async () => {
  for (let i = 0; i < 7; i++) saveTransaction(phoneA, USER, expense({ note: `#${i}` }));
  await sync(phoneA);

  const reinstalled = newDevice();
  await pullAll(reinstalled, server.backend(), 3); // small pages to exercise paging
  expect(listTransactions(reinstalled)).toHaveLength(7);
});

it('pull uses server_seq, so a wrong device clock does not matter', async () => {
  jest.setSystemTime(Date.parse('2001-01-01T00:00:00Z')); // phone A's clock is years behind
  saveTransaction(phoneA, USER, expense({ note: 'from the past' }));
  await sync(phoneA);
  jest.setSystemTime(clock);
  await sync(phoneB);
  expect(listTransactions(phoneB).map((t) => t.note)).toEqual(['from the past']);
});

it('pull never overwrites a pending local edit', async () => {
  const { id } = saveTransaction(phoneA, USER, expense({ note: 'v1' }));
  await sync(phoneA);
  await sync(phoneB);
  tick();
  saveTransaction(phoneB, USER, expense({ note: 'B local' }), id);
  tick();
  saveTransaction(phoneA, USER, expense({ note: 'A newer' }), id);
  await sync(phoneA);

  await pullAll(phoneB, server.backend());
  expect(getTransaction(phoneB, id)?.note).toBe('B local');
});

it('several edits to one row are sent as one change', async () => {
  const { id } = saveTransaction(phoneA, USER, expense({ note: 'a' }));
  tick();
  saveTransaction(phoneA, USER, expense({ note: 'b' }), id);
  tick();
  saveTransaction(phoneA, USER, expense({ note: 'c' }), id);
  await pushAll(phoneA, server.backend());
  expect(server.pushCalls).toHaveLength(1);
  expect(server.pushCalls[0]).toHaveLength(1);
  expect(server.rows('transactions')[0]?.note).toBe('c');
});

it('pushes parents before children and in batches', async () => {
  const pets = createCategory(phoneA, USER, { name: 'Pets', type: 'expense', icon: 'paw', color: '#000' });
  saveTransaction(phoneA, USER, expense({ categoryId: pets.id }));
  for (let i = 0; i < 4; i++) saveTransaction(phoneA, USER, expense());

  await pushAll(phoneA, server.backend(), 2);
  expect(server.pushCalls.map((c) => c.length)).toEqual([2, 2, 2]);
  expect(server.pushCalls[0]?.map((c) => c.table)).toEqual(['categories', 'transactions']);
  expect(listTransactions(phoneA).every((t) => t.serverSeq !== null)).toBe(true);
});
