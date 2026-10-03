import { createTestDb } from '@/test/testDb';
import type { Poisha } from '@/utils/money';

import { defaultRowId } from '../defaults';
import { seedDefaults } from '../seed';
import type { LocalDb } from '../types';
import { deleteTransaction, saveTransaction, searchTransactions, totalsOf } from './transactions';

const USER = '11111111-1111-1111-1111-111111111111';
const food = defaultRowId(USER, 'category', 'food');
const transport = defaultRowId(USER, 'category', 'transport');
const salary = defaultRowId(USER, 'category', 'salary');
const cash = defaultRowId(USER, 'account', 'cash');
const bkash = defaultRowId(USER, 'account', 'bkash');
const p = (n: number) => n as Poisha;

let db: LocalDb;
beforeEach(() => {
  db = createTestDb();
  seedDefaults(db, USER);
  const add = (type: 'expense' | 'income', amount: number, categoryId: string, occurredOn: string, note: string | null, accountId = cash) =>
    saveTransaction(db, USER, { type, amount: p(amount), categoryId, accountId, note, occurredOn });
  add('expense', 12000, food, '2026-10-01', 'Shwapno groceries');
  add('expense', 3500, transport, '2026-10-02', 'Pathao to office');
  add('expense', 150000, food, '2026-09-20', 'Wedding dinner 50% share', bkash);
  add('income', 5000000, salary, '2026-10-01', null);
  saveTransaction(db, USER, { type: 'transfer', amount: p(20000), accountId: cash, toAccountId: bkash, note: 'top up', occurredOn: '2026-10-03' });
  deleteTransaction(db, add('expense', 999, food, '2026-10-04', 'Shwapno deleted').id);
});

const notes = (filter: Parameters<typeof searchTransactions>[1]) => searchTransactions(db, filter).map((t) => t.note);

it('matches note, category or account name, case-insensitively', () => {
  expect(notes({ text: 'shwapno' })).toEqual(['Shwapno groceries']); // deleted row excluded
  expect(notes({ text: 'TRANSPORT' })).toEqual(['Pathao to office']);
  expect(notes({ text: 'bkash' })).toEqual(['top up', 'Wedding dinner 50% share']);
});

it('treats % and _ literally', () => {
  expect(notes({ text: '50%' })).toEqual(['Wedding dinner 50% share']);
  expect(notes({ text: '%' })).toEqual(['Wedding dinner 50% share']);
  expect(notes({ text: '_' })).toEqual([]);
});

it('filters by date range, type, category and amount', () => {
  expect(notes({ from: '2026-10-01', to: '2026-10-02' })).toEqual(['Pathao to office', null, 'Shwapno groceries']); // same day: newest created first
  expect(notes({ types: ['transfer'] })).toEqual(['top up']);
  expect(notes({ categoryIds: [food] })).toEqual(['Shwapno groceries', 'Wedding dinner 50% share']);
  expect(notes({ minAmount: p(10000), maxAmount: p(150000), types: ['expense'] })).toEqual(['Shwapno groceries', 'Wedding dinner 50% share']);
});

it('combines filters', () => {
  expect(notes({ text: 'o', categoryIds: [food], from: '2026-10-01' })).toEqual(['Shwapno groceries']);
});

it('totalsOf sums income and expense, ignoring transfers', () => {
  expect(totalsOf(searchTransactions(db, { from: '2026-10-01' }))).toEqual({ income: 5000000, expense: 15500 });
});
