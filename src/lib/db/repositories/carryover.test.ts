import { createTestDb } from '@/test/testDb';
import type { Poisha } from '@/utils/money';

import { defaultRowId } from '../defaults';
import { seedDefaults } from '../seed';
import type { LocalDb } from '../types';
import { listAccountsWithBalance } from './accounts';
import { carryOverBalances } from './carryover';
import { listCategories } from './categories';
import { monthTotals } from './summary';
import { deleteTransaction, listTransactions, saveTransaction } from './transactions';

const USER = '11111111-1111-1111-1111-111111111111';
const p = (n: number) => n as Poisha;
const cash = defaultRowId(USER, 'account', 'cash');
const bkash = defaultRowId(USER, 'account', 'bkash');
const salary = defaultRowId(USER, 'category', 'salary');
const food = defaultRowId(USER, 'category', 'food');

let db: LocalDb;
beforeEach(() => {
  db = createTestDb();
  seedDefaults(db, USER);
  saveTransaction(db, USER, { type: 'income', amount: p(100000), categoryId: salary, accountId: cash, note: null, occurredOn: '2026-10-01' });
  saveTransaction(db, USER, { type: 'expense', amount: p(30000), categoryId: food, accountId: cash, note: null, occurredOn: '2026-10-20' });
  saveTransaction(db, USER, { type: 'expense', amount: p(5000), categoryId: food, accountId: bkash, note: null, occurredOn: '2026-10-21' });
  // Next month's spending must not count towards October's closing balance.
  saveTransaction(db, USER, { type: 'expense', amount: p(1000), categoryId: food, accountId: cash, note: null, occurredOn: '2026-11-02' });
});

const carried = () => listTransactions(db, { month: '2026-11' }).filter((t) => t.categoryName === 'Carryover');

describe('carryOverBalances', () => {
  it("adds last month's positive wallet balances as income on the 1st", () => {
    expect(carryOverBalances(db, USER, '2026-11')).toBe(1); // bKash is negative: skipped
    expect(carried().map((t) => [t.accountId, t.amount, t.occurredOn])).toEqual([[cash, 70000, '2026-11-01']]);
    expect(monthTotals(db, '2026-11').income).toBe(70000);
  });

  it('does not change wallet balances and is idempotent', () => {
    const before = listAccountsWithBalance(db, false);
    carryOverBalances(db, USER, '2026-11');
    carryOverBalances(db, USER, '2026-11');
    expect(listAccountsWithBalance(db, false)).toEqual(before.map((a) => expect.objectContaining({ id: a.id, balance: a.balance })));
    expect(carried()).toHaveLength(1);
    expect(listCategories(db, 'income', USER).some((c) => c.name === 'Carryover')).toBe(false); // hidden from pickers
  });

  it('removes a carried row when the balance drops to zero', () => {
    carryOverBalances(db, USER, '2026-11');
    deleteTransaction(db, listTransactions(db, { month: '2026-10' }).find((t) => t.type === 'income')!.id);
    expect(carryOverBalances(db, USER, '2026-11')).toBe(0);
    expect(carried()).toHaveLength(0);
  });
});
