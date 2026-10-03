import type { TransactionListItem } from '@/lib/db/repositories/transactions';

import { transactionsCsv } from './transactionsCsv';

const base = {
  userId: 'u',
  updatedAt: '2026-10-01T00:00:00.000Z',
  deletedAt: null,
  serverSeq: 1,
  categoryIcon: null,
  categoryColor: null,
  accountId: 'a',
  toAccountId: null,
  categoryId: 'c',
  recurringId: null,
  toAccountName: null,
} as const;

const item = (over: Partial<TransactionListItem>): TransactionListItem =>
  ({ ...base, id: 'x', type: 'expense', amount: 25050, occurredOn: '2026-10-02', createdAt: '2026-10-02T10:00:00.000Z', categoryName: 'Food & Groceries', accountName: 'Cash', note: null, ...over }) as TransactionListItem;

it('writes oldest first with signed taka amounts and safe text', () => {
  const csv = transactionsCsv([
    item({ id: '2', type: 'income', amount: 5000000 as never, occurredOn: '2026-10-05', categoryName: 'Salary', note: 'October' }),
    item({ id: '1', note: '=1+1, really' }),
    item({ id: '3', type: 'transfer', amount: 20000 as never, occurredOn: '2026-10-03', categoryName: null, toAccountName: 'bKash', recurringId: 'r' }),
  ]);
  expect(csv.split('\r\n')).toEqual([
    '﻿Date,Type,Amount (BDT),Category,Account,To account,Note,Repeating',
    `2026-10-02,expense,-250.50,Food & Groceries,Cash,,"'=1+1, really",`,
    '2026-10-03,transfer,200.00,,Cash,bKash,,yes',
    '2026-10-05,income,50000.00,Salary,Cash,,October,',
    '',
  ]);
});
