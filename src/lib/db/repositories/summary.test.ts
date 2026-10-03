import { createTestDb } from '@/test/testDb';
import type { Poisha } from '@/utils/money';

import { defaultRowId } from '../defaults';
import { seedDefaults } from '../seed';
import type { LocalDb } from '../types';
import { deleteCategory } from './categories';
import { categoryComparison, expenseByCategory, monthlyTrend, monthTotals } from './summary';
import { deleteTransaction, saveTransaction, type EntryInput } from './transactions';

const USER = '11111111-1111-1111-1111-111111111111';
const food = defaultRowId(USER, 'category', 'food');
const transport = defaultRowId(USER, 'category', 'transport');
const salary = defaultRowId(USER, 'category', 'salary');

let db: LocalDb;
const add = (type: 'expense' | 'income', amount: number, categoryId: string, occurredOn = '2026-10-15') =>
  saveTransaction(db, USER, {
    type,
    amount: amount as Poisha,
    categoryId,
    accountId: defaultRowId(USER, 'account', 'cash'),
    note: null,
    occurredOn,
  } satisfies EntryInput);

beforeEach(() => {
  db = createTestDb();
  seedDefaults(db, USER);
  add('income', 5000000, salary);
  add('expense', 30000, food);
  add('expense', 20050, food, '2026-10-01');
  add('expense', 10000, transport, '2026-10-31');
  add('expense', 99999, food, '2026-09-30'); // previous month
  add('expense', 77777, food, '2026-11-01'); // next month
  deleteTransaction(db, add('expense', 55555, transport).id);
});

it('monthTotals counts only that month and ignores deleted rows', () => {
  expect(monthTotals(db, '2026-10')).toEqual({ income: 5000000, expense: 60050, balance: 5000000 - 60050 });
});

it('monthTotals for an empty month is zero', () => {
  expect(monthTotals(db, '2025-01')).toEqual({ income: 0, expense: 0, balance: 0 });
});

it('expenseByCategory sorts biggest first', () => {
  expect(expenseByCategory(db, '2026-10').map((c) => [c.name, c.total])).toEqual([
    ['Food & Groceries', 50050],
    ['Transport', 10000],
  ]);
});

it('deleted categories keep their name in the breakdown', () => {
  deleteCategory(db, transport);
  expect(expenseByCategory(db, '2026-10').map((c) => c.name)).toContain('Transport');
});

it('transfers are left out of monthly totals and the category breakdown', () => {
  saveTransaction(db, USER, {
    type: 'transfer',
    amount: 123456 as Poisha,
    accountId: defaultRowId(USER, 'account', 'cash'),
    toAccountId: defaultRowId(USER, 'account', 'bank'),
    note: null,
    occurredOn: '2026-10-10',
  });
  expect(monthTotals(db, '2026-10')).toEqual({ income: 5000000, expense: 60050, balance: 5000000 - 60050 });
  expect(expenseByCategory(db, '2026-10')).toHaveLength(2);
});

it('monthlyTrend zero-fills and covers the months ending at the given one', () => {
  expect(monthlyTrend(db, '2026-11', 4)).toEqual([
    { month: '2026-08', income: 0, expense: 0 },
    { month: '2026-09', income: 0, expense: 99999 },
    { month: '2026-10', income: 5000000, expense: 60050 },
    { month: '2026-11', income: 0, expense: 77777 },
  ]);
});

it('categoryComparison lines up this month against last, including categories only in one of them', () => {
  add('expense', 5000, transport, '2026-09-15');
  const rows = categoryComparison(db, '2026-10').map((c) => [c.name, c.total, c.previous, c.change]);
  expect(rows).toEqual([
    ['Food & Groceries', 50050, 99999, 50050 - 99999],
    ['Transport', 10000, 5000, 5000],
  ]);
  expect(categoryComparison(db, '2026-11').map((c) => [c.name, c.total, c.previous])).toEqual([
    ['Food & Groceries', 77777, 50050],
    ['Transport', 0, 10000],
  ]);
});
