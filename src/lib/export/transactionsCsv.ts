import type { TransactionListItem } from '@/lib/db/repositories/transactions';
import { poishaToTakaString } from '@/lib/sync/mapping';
import { safeText, toCsv } from '@/utils/csv';

const HEADER = ['Date', 'Type', 'Amount (BDT)', 'Category', 'Account', 'To account', 'Note', 'Repeating'];

/**
 * Transactions as CSV, oldest first. Amounts are plain numbers in taka
 * (expenses negative, transfers positive) so spreadsheets can sum them.
 */
export function transactionsCsv(items: readonly TransactionListItem[]): string {
  const rows = [...items]
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.createdAt.localeCompare(b.createdAt))
    .map((t) => [
      t.occurredOn,
      t.type,
      poishaToTakaString(t.type === 'expense' ? -t.amount : t.amount),
      safeText(t.type === 'transfer' ? '' : (t.categoryName ?? 'Uncategorized')),
      safeText(t.accountName),
      safeText(t.toAccountName),
      safeText(t.note),
      t.recurringId ? 'yes' : '',
    ]);
  return toCsv(HEADER, rows);
}

export const exportFileName = (today: string) => `spendwise-transactions-${today}.csv`;
