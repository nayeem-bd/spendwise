import type { TransactionListItem } from '@/lib/db/repositories/transactions';
import { todayISO } from '@/utils/date';

import { shareTextFile } from './shareFile';
import { exportFileName, transactionsCsv } from './transactionsCsv';

/** Saves/shares the given transactions as a CSV file. */
export async function exportTransactions(items: readonly TransactionListItem[]): Promise<void> {
  if (items.length === 0) throw new Error('Nothing to export');
  await shareTextFile(exportFileName(todayISO()), transactionsCsv(items), 'text/csv');
}
