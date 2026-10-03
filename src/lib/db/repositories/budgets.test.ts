import { createTestDb } from '@/test/testDb';
import type { Poisha } from '@/utils/money';

import { defaultRowId } from '../defaults';
import { budgets, outbox } from '../schema';
import { seedDefaults } from '../seed';
import type { LocalDb } from '../types';
import { budgetCrossings, budgetId, budgetStatuses, getBudget, removeBudget, setBudget } from './budgets';
import { deleteCategory } from './categories';
import { saveTransaction } from './transactions';

const USER = '11111111-1111-1111-1111-111111111111';
const food = defaultRowId(USER, 'category', 'food');
const transport = defaultRowId(USER, 'category', 'transport');
const p = (n: number) => n as Poisha;

let db: LocalDb;
beforeEach(() => {
  db = createTestDb();
  seedDefaults(db, USER);
});

const spend = (amount: number, categoryId = food, occurredOn = '2026-10-10') =>
  saveTransaction(db, USER, {
    type: 'expense',
    amount: p(amount),
    categoryId,
    accountId: defaultRowId(USER, 'account', 'cash'),
    note: null,
    occurredOn,
  });

it('computes spent, ratio and level per category and for the month', () => {
  setBudget(db, USER, { categoryId: food, month: '2026-10', amount: p(100000) });
  setBudget(db, USER, { categoryId: transport, month: '2026-10', amount: p(50000) });
  setBudget(db, USER, { categoryId: null, month: '2026-10', amount: p(110000) }); // 95000 / 110000 = 86%
  spend(85000);
  spend(10000, transport);
  spend(99999, food, '2026-09-30'); // other month

  const { total, categories } = budgetStatuses(db, '2026-10');
  expect(total).toMatchObject({ amount: 110000, spent: 95000, level: 'warning' });
  expect(categories.map((c) => [c.name, c.spent, c.level])).toEqual([
    ['Food & Groceries', 85000, 'warning'],
    ['Transport', 10000, 'ok'],
  ]);
});

it('carries a budget forward to later months until changed', () => {
  setBudget(db, USER, { categoryId: food, month: '2026-08', amount: p(100000) });
  expect(getBudget(db, food, '2026-07')).toBeUndefined();
  expect(budgetStatuses(db, '2026-10').categories[0]).toMatchObject({ amount: 100000, carriedFrom: '2026-08' });

  setBudget(db, USER, { categoryId: food, month: '2026-10', amount: p(150000) });
  expect(getBudget(db, food, '2026-09')?.amount).toBe(100000);
  expect(budgetStatuses(db, '2026-11').categories[0]).toMatchObject({ amount: 150000, carriedFrom: '2026-10' });
});

it('removing a budget stops it from that month on, keeping earlier months', () => {
  setBudget(db, USER, { categoryId: food, month: '2026-08', amount: p(100000) });
  removeBudget(db, USER, food, '2026-10');
  expect(getBudget(db, food, '2026-09')?.amount).toBe(100000);
  expect(getBudget(db, food, '2026-10')).toBeUndefined();
  expect(getBudget(db, food, '2026-12')).toBeUndefined();

  setBudget(db, USER, { categoryId: food, month: '2026-10', amount: p(5000) }); // set again: undeletes
  expect(getBudget(db, food, '2026-11')?.amount).toBe(5000);
});

it('uses deterministic ids so devices never create duplicates', () => {
  const a = setBudget(db, USER, { categoryId: food, month: '2026-10', amount: p(100) });
  const b = setBudget(db, USER, { categoryId: food, month: '2026-10', amount: p(200) });
  expect(a.id).toBe(b.id);
  expect(a.id).toBe(budgetId(USER, food, '2026-10'));
  expect(db.select().from(budgets).all()).toHaveLength(1);
  expect(db.select().from(outbox).all()).toHaveLength(2); // both edits queued, collapsed at push
});

it('hides budgets of deleted categories', () => {
  setBudget(db, USER, { categoryId: food, month: '2026-10', amount: p(100) });
  deleteCategory(db, food);
  expect(budgetStatuses(db, '2026-10').categories).toHaveLength(0);
});

it('rejects zero budgets', () => {
  expect(() => setBudget(db, USER, { categoryId: food, month: '2026-10', amount: p(0) })).toThrow('Enter a budget above ৳0');
});

it('reports only budgets whose level went up', () => {
  setBudget(db, USER, { categoryId: food, month: '2026-10', amount: p(10000) });
  setBudget(db, USER, { categoryId: null, month: '2026-10', amount: p(100000) });
  spend(7000);

  const before = budgetStatuses(db, '2026-10');
  spend(1500); // food 85% → warning; total 8.5% stays ok
  const crossed = budgetCrossings(before, budgetStatuses(db, '2026-10'));
  expect(crossed.map((c) => [c.name, c.level])).toEqual([['Food & Groceries', 'warning']]);

  const again = budgetStatuses(db, '2026-10');
  spend(100); // still warning: no new alert
  expect(budgetCrossings(again, budgetStatuses(db, '2026-10'))).toEqual([]);

  const nearly = budgetStatuses(db, '2026-10');
  spend(2000); // over 100%
  expect(budgetCrossings(nearly, budgetStatuses(db, '2026-10')).map((c) => c.level)).toEqual(['over']);
});
