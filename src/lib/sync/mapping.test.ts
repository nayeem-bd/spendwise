import type { Transaction } from '@/lib/db/schema';

import { fromServerRow, poishaToTakaString, takaToPoisha, toServerRow } from './mapping';

describe('money conversion', () => {
  it.each([
    [25050, '250.50'],
    [5, '0.05'],
    [0, '0.00'],
    [-50000, '-500.00'],
    [1000000000, '10000000.00'],
  ])('%i poisha → "%s"', (poisha, taka) => {
    expect(poishaToTakaString(poisha)).toBe(taka);
    expect(takaToPoisha(taka)).toBe(poisha);
  });

  it('accepts numbers from PostgREST', () => {
    expect(takaToPoisha(250.5)).toBe(25050);
    expect(takaToPoisha(0.29)).toBe(29);
  });
});

describe('row mapping', () => {
  const local: Transaction = {
    id: 't1',
    userId: 'u1',
    createdAt: '2026-10-03T10:00:00.000Z',
    updatedAt: '2026-10-03T10:00:00.000Z',
    deletedAt: null,
    serverSeq: null,
    accountId: 'a1',
    categoryId: 'c1',
    type: 'expense',
    amount: 25050 as Transaction['amount'],
    toAccountId: null,
    note: 'tea',
    occurredOn: '2026-10-03',
    recurringId: null,
  };

  it('converts to server column names and taka, without server_seq', () => {
    expect(toServerRow('transactions', local)).toEqual({
      id: 't1',
      user_id: 'u1',
      created_at: '2026-10-03T10:00:00.000Z',
      updated_at: '2026-10-03T10:00:00.000Z',
      deleted_at: null,
      account_id: 'a1',
      category_id: 'c1',
      type: 'expense',
      amount: '250.50',
      to_account_id: null,
      note: 'tea',
      occurred_on: '2026-10-03',
      recurring_id: null,
    });
  });

  it('round-trips, normalising Postgres timestamps', () => {
    const server = { ...toServerRow('transactions', local), amount: 250.5, server_seq: 7, updated_at: '2026-10-03T10:00:00+00:00' };
    expect(fromServerRow('transactions', server)).toEqual({ ...local, serverSeq: 7 });
  });
});
