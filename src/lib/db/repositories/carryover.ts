import { addMonths, monthRange } from '@/utils/date';

import { categories, transactions } from '../schema';
import type { LocalDb } from '../types';
import { uuidv5 } from '../uuidv5';
import { softDeleteRow, upsertRow } from '../write';
import { carryoverCategoryId, listAccountsWithBalance } from './accounts';
import { getCategory } from './categories';
import { getTransaction } from './transactions';

/**
 * Adds each of your regular wallets' balance at the end of the previous month
 * as "Carryover" income on the 1st of `month` ('YYYY-MM'). Ids are deterministic
 * per wallet and month, so pressing it again (on any device) updates the rows
 * instead of duplicating them. Wallets at zero or below get no row.
 * Returns how many wallets were carried over.
 */
export function carryOverBalances(db: LocalDb, userId: string, month: string): number {
  const categoryId = carryoverCategoryId(userId);
  const category = getCategory(db, categoryId);
  if (!category || category.deletedAt) {
    // Archived: labels its rows but stays out of the pickers.
    upsertRow(db, categories, {
      id: categoryId,
      userId,
      name: 'Carryover',
      type: 'income',
      icon: 'calendar-arrow-right',
      color: '#607D8B',
      sortOrder: 99,
      archived: true,
    });
  }

  const occurredOn = monthRange(month).start;
  let count = 0;
  for (const account of listAccountsWithBalance(db, false, monthRange(addMonths(month, -1)).end)) {
    if (account.userId !== userId) continue; // a co-member's shared wallet is theirs to carry over
    const id = uuidv5(`carryover:${account.id}:${month}`, userId);
    if (account.balance > 0) {
      upsertRow(db, transactions, {
        id,
        userId,
        type: 'income',
        amount: account.balance,
        accountId: account.id,
        categoryId,
        toAccountId: null,
        note: null,
        occurredOn,
        recurringId: null,
      });
      count++;
    } else if (getTransaction(db, id)?.deletedAt === null) {
      softDeleteRow(db, transactions, id);
    }
  }
  return count;
}
