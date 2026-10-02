import { createTestDb } from '@/test/testDb';
import type { Poisha } from '@/utils/money';

import { onTablesChanged } from '../changes';
import { defaultRowId } from '../defaults';
import { outbox, transactions } from '../schema';
import { seedDefaults } from '../seed';
import type { LocalDb } from '../types';
import { wipeLocalData } from '../wipe';
import {
  createAccount,
  deleteAccount,
  listAccounts,
  listAccountsWithBalance,
} from './accounts';
import { createCategory, deleteCategory, listCategories, updateCategory } from './categories';
import { deleteTransaction, groupByDay, listTransactions, saveTransaction, type TransactionInput } from './transactions';
import { ValidationError } from './validate';

const USER = '11111111-1111-1111-1111-111111111111';
const p = (n: number) => n as Poisha;
const outboxRows = (db: LocalDb) => db.select().from(outbox).all();

let db: LocalDb;
beforeEach(() => {
  db = createTestDb();
  seedDefaults(db, USER);
});

const cash = () => defaultRowId(USER, 'account', 'cash');
const bkash = () => defaultRowId(USER, 'account', 'bkash');
const food = () => defaultRowId(USER, 'category', 'food');
const salary = () => defaultRowId(USER, 'category', 'salary');

const expense = (overrides: Partial<TransactionInput> = {}): TransactionInput => ({
  type: 'expense',
  amount: p(25050),
  categoryId: food(),
  accountId: cash(),
  note: null,
  occurredOn: '2026-10-03',
  ...overrides,
});

describe('seedDefaults', () => {
  it('creates defaults with server-matching ids, without outbox entries', () => {
    // Seeded together, so same created_at: ties fall back to name order.
    expect(listAccounts(db).map((a) => a.name)).toEqual(['Bank', 'Cash', 'bKash']);
    expect(listCategories(db, 'expense')).toHaveLength(11);
    expect(listCategories(db, 'income')).toHaveLength(5);
    expect(listCategories(db).find((c) => c.name === 'Food & Groceries')?.id).toBe(food());
    expect(outboxRows(db)).toHaveLength(0);
  });

  it('is idempotent and keeps local edits', () => {
    updateCategory(db, food(), { name: 'Bazar' });
    seedDefaults(db, USER);
    expect(listCategories(db, 'expense')).toHaveLength(11);
    expect(listCategories(db).find((c) => c.id === food())?.name).toBe('Bazar');
  });
});

describe('writes go to the row and the outbox together', () => {
  it('create queues an upsert with the full row', () => {
    const tx = saveTransaction(db, USER, expense({ note: '  tea  ' }));
    const [entry] = outboxRows(db);
    expect(entry).toMatchObject({ tableName: 'transactions', rowId: tx.id, op: 'upsert', attempts: 0 });
    expect(JSON.parse(entry!.payload)).toMatchObject({ id: tx.id, amount: 25050, note: 'tea', userId: USER });
  });

  it('update bumps updated_at and queues another entry', () => {
    const tx = saveTransaction(db, USER, expense());
    const updated = saveTransaction(db, USER, expense({ amount: p(100) }), tx.id);
    expect(updated.amount).toBe(100);
    expect(updated.createdAt).toBe(tx.createdAt);
    expect(updated.updatedAt >= tx.updatedAt).toBe(true);
    expect(outboxRows(db).map((e) => e.op)).toEqual(['upsert', 'upsert']);
  });

  it('delete is soft and queues a delete', () => {
    const tx = saveTransaction(db, USER, expense());
    deleteTransaction(db, tx.id);
    expect(listTransactions(db)).toHaveLength(0);
    const row = db.select().from(transactions).all()[0];
    expect(row?.deletedAt).not.toBeNull();
    expect(outboxRows(db).map((e) => e.op)).toEqual(['upsert', 'delete']);
  });

  it('a failed write leaves neither row nor outbox entry', () => {
    expect(() => saveTransaction(db, USER, expense(), 'no-such-id')).toThrow();
    expect(db.select().from(transactions).all()).toHaveLength(0);
    expect(outboxRows(db)).toHaveLength(0);
  });

  it('notifies listeners after commit', () => {
    const seen: string[][] = [];
    const off = onTablesChanged((t) => seen.push([...t]));
    saveTransaction(db, USER, expense());
    off();
    expect(seen).toEqual([['transactions', 'outbox']]);
  });
});

describe('validation', () => {
  it.each([
    [{ amount: p(0) }, 'Enter an amount above ৳0'],
    [{ amount: p(1.5) }, 'Enter an amount above ৳0'],
    [{ categoryId: '' }, 'Pick a category'],
    [{ accountId: '' }, 'Pick an account'],
    [{ occurredOn: '03/10/2026' }, 'Invalid date'],
  ])('rejects %p', (overrides, message) => {
    expect(() => saveTransaction(db, USER, expense(overrides))).toThrow(new ValidationError(message));
  });

  it('requires a category name', () => {
    expect(() => createCategory(db, USER, { name: '  ', type: 'expense', icon: 'tag', color: '#000' })).toThrow(
      ValidationError,
    );
  });
});

describe('categories', () => {
  it('appends new categories after existing ones of the same type', () => {
    const c = createCategory(db, USER, { name: 'Pets', type: 'expense', icon: 'paw', color: '#795548' });
    expect(c.sortOrder).toBe(11);
    expect(listCategories(db, 'expense').at(-1)?.name).toBe('Pets');
  });

  it('deleted categories disappear from pickers but still label old transactions', () => {
    saveTransaction(db, USER, expense());
    deleteCategory(db, food());
    expect(listCategories(db).some((c) => c.id === food())).toBe(false);
    expect(listTransactions(db)[0]?.categoryName).toBe('Food & Groceries');
  });
});

describe('account balances are computed from transactions', () => {
  it('initial balance + income - expense, ignoring deleted transactions', () => {
    const wallet = createAccount(db, USER, { name: 'Wallet', initialBalance: p(100000), icon: 'wallet', color: '#000' });
    saveTransaction(db, USER, expense({ accountId: wallet.id, amount: p(25050) }));
    saveTransaction(db, USER, { ...expense({ accountId: wallet.id, amount: p(500000) }), type: 'income', categoryId: salary() });
    const deleted = saveTransaction(db, USER, expense({ accountId: wallet.id, amount: p(999) }));
    deleteTransaction(db, deleted.id);
    saveTransaction(db, USER, expense({ accountId: bkash(), amount: p(700) }));

    const balances = Object.fromEntries(listAccountsWithBalance(db).map((a) => [a.name, a.balance]));
    expect(balances).toEqual({ Cash: 0, bKash: -700, Bank: 0, Wallet: 100000 - 25050 + 500000 });
  });

  it('refuses to delete the last account', () => {
    const [first, ...rest] = listAccounts(db);
    rest.forEach((a) => deleteAccount(db, a.id));
    expect(() => deleteAccount(db, first!.id)).toThrow('You need at least one account');
  });
});

describe('wipeLocalData', () => {
  it('removes everything', () => {
    saveTransaction(db, USER, expense());
    wipeLocalData(db);
    expect(listAccounts(db)).toHaveLength(0);
    expect(listTransactions(db)).toHaveLength(0);
    expect(outboxRows(db)).toHaveLength(0);
  });
});

describe('listTransactions by month and groupByDay', () => {
  it('filters by month and groups newest day first with net totals', () => {
    saveTransaction(db, USER, expense({ occurredOn: '2026-10-03', amount: p(1000) }));
    saveTransaction(db, USER, { ...expense({ occurredOn: '2026-10-03', amount: p(5000) }), type: 'income', categoryId: salary() });
    saveTransaction(db, USER, expense({ occurredOn: '2026-10-01', amount: p(300) }));
    saveTransaction(db, USER, expense({ occurredOn: '2026-09-30', amount: p(999) }));

    const october = listTransactions(db, { month: '2026-10' });
    expect(october).toHaveLength(3);
    expect(groupByDay(october).map((s) => [s.day, s.data.length, s.net])).toEqual([
      ['2026-10-03', 2, 4000],
      ['2026-10-01', 1, -300],
    ]);
  });
});
