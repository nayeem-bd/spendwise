import { createTestDb } from '@/test/testDb';
import type { Poisha } from '@/utils/money';

import { defaultRowId } from '../defaults';
import { seedDefaults } from '../seed';
import type { LocalDb } from '../types';
import { createAccount } from './accounts';
import { deleteCategory } from './categories';
import { categoryComparison, dailyExpense, expenseByCategory, frequentNotes, monthlyTrend, monthTotals, spendingPace } from './summary';
import { deleteTransaction, listTransactions, saveTransaction, type EntryInput } from './transactions';

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
  expect(monthTotals(db, '2026-10')).toEqual({ income: 5000000, expense: 60050, saved: 0, balance: 5000000 - 60050 });
});

it('monthTotals for an empty month is zero', () => {
  expect(monthTotals(db, '2025-01')).toEqual({ income: 0, expense: 0, saved: 0, balance: 0 });
});

it('expenseByCategory sorts biggest first and counts transactions', () => {
  expect(expenseByCategory(db, '2026-10').map((c) => [c.name, c.total, c.count])).toEqual([
    ['Food & Groceries', 50050, 2],
    ['Transport', 10000, 1],
  ]);
});

it('dailyExpense has one zero-filled entry per day of the month', () => {
  const days = dailyExpense(db, '2026-10');
  expect(days).toHaveLength(31);
  expect([days[0], days[14], days[30], days[1]]).toEqual([20050, 30000, 10000, 0]);
  expect(dailyExpense(db, '2026-02')).toHaveLength(28);
});

it('frequentNotes ranks the notes of a category by use, then by recency', () => {
  const note = (text: string | null, occurredOn: string, categoryId = food) =>
    saveTransaction(db, USER, { type: 'expense', amount: 100 as Poisha, categoryId, accountId: defaultRowId(USER, 'account', 'cash'), note: text, occurredOn });
  note('Lunch', '2026-10-02');
  note('Lunch', '2026-10-03');
  note('Bazar', '2026-10-01');
  note('Tea', '2026-10-05');
  note('Rickshaw', '2026-10-05', transport);
  deleteTransaction(db, note('Gone', '2026-10-09').id);
  expect(frequentNotes(db, food)).toEqual(['Lunch', 'Tea', 'Bazar']);
  expect(frequentNotes(db, food, 1)).toEqual(['Lunch']);
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
  expect(monthTotals(db, '2026-10')).toEqual({ income: 5000000, expense: 60050, saved: 0, balance: 5000000 - 60050 });
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

it('spendingPace averages the days so far and is only for the current month', () => {
  const days = dailyExpense(db, '2026-10');
  expect(spendingPace(days, '2026-10', '2026-10-15')).toEqual({ today: 30000, averagePerDay: 3300, elapsed: 15 });
  expect(spendingPace(days, '2026-10', '2026-11-02')).toBeNull();
  expect(spendingPace(days, '2026-10', '2026-09-30')).toBeNull();
});

describe('savings accounts', () => {
  const cash = defaultRowId(USER, 'account', 'cash');
  let dps: string;
  beforeEach(() => {
    dps = createAccount(db, USER, { name: 'DPS', initialBalance: 0 as Poisha, icon: 'piggy-bank', color: '#000', savings: true }).id;
    saveTransaction(db, USER, { type: 'transfer', amount: 500000 as Poisha, accountId: cash, toAccountId: dps, note: null, occurredOn: '2026-10-05' });
    saveTransaction(db, USER, { type: 'income', amount: 12345 as Poisha, accountId: dps, categoryId: salary, note: 'profit', occurredOn: '2026-10-06' });
    saveTransaction(db, USER, { type: 'expense', amount: 500 as Poisha, accountId: dps, categoryId: food, note: 'fee', occurredOn: '2026-10-06' });
  });

  it('are left out of income, expense, categories, trend and daily spending', () => {
    expect(monthTotals(db, '2026-10')).toEqual({ income: 5000000, expense: 60050, saved: 500000, balance: 5000000 - 60050 - 500000 });
    expect(expenseByCategory(db, '2026-10').find((c) => c.categoryId === food)?.total).toBe(50050);
    expect(monthlyTrend(db, '2026-10', 1)).toEqual([{ month: '2026-10', income: 5000000, expense: 60050 }]);
    expect(dailyExpense(db, '2026-10')[5]).toBe(0);
  });

  it('money moved into savings leaves the balance, and comes back when withdrawn', () => {
    saveTransaction(db, USER, { type: 'transfer', amount: 200000 as Poisha, accountId: dps, toAccountId: cash, note: null, occurredOn: '2026-10-20' });
    const other = createAccount(db, USER, { name: 'FDR', initialBalance: 0 as Poisha, icon: 'bank', color: '#000', savings: true }).id;
    saveTransaction(db, USER, { type: 'transfer', amount: 99999 as Poisha, accountId: dps, toAccountId: other, note: null, occurredOn: '2026-10-21' });
    expect(monthTotals(db, '2026-10')).toMatchObject({ expense: 60050, saved: 300000, balance: 5000000 - 60050 - 300000 });
    expect(monthTotals(db, '2026-11').saved).toBe(0);
  });

  it('a row whose account is gone still counts in the main view', () => {
    saveTransaction(db, USER, { type: 'expense', amount: 100 as Poisha, accountId: 'gone', categoryId: food, note: null, occurredOn: '2026-10-07' });
    expect(monthTotals(db, '2026-10').expense).toBe(60150);
  });

  it('listTransactions splits main and savings rows; all keeps both', () => {
    const count = (scope: 'main' | 'savings' | 'all') => listTransactions(db, { month: '2026-10', scope }).length;
    expect(count('savings')).toBe(3);
    expect(count('main')).toBe(4);
    expect(count('all')).toBe(7);
    expect(listTransactions(db, { accountId: dps }).length).toBe(3);
    expect(listTransactions(db, { accountId: cash, scope: 'main' }).length).toBe(6); // all months, minus the DPS transfer
  });
});
