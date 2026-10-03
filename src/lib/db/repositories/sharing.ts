import { and, eq, isNotNull, isNull, ne } from 'drizzle-orm';

import { notifyChanged } from '../changes';
import { accountMembers, accounts, attachmentFiles, attachments, transactions, type AccountMember } from '../schema';
import type { LocalDb } from '../types';

// Shared wallets: who shares which account. Membership rows only arrive by
// pull (the server's RPCs write them); the device never writes them.

/** Active members of an account, owner first. Empty if it isn't shared. */
export function listMembers(db: LocalDb, accountId: string): AccountMember[] {
  return db
    .select()
    .from(accountMembers)
    .where(and(eq(accountMembers.accountId, accountId), isNull(accountMembers.deletedAt)))
    .all()
    .sort((a, b) => (a.role === b.role ? a.email.localeCompare(b.email) : a.role === 'owner' ? -1 : 1));
}

/** Email of a co-member (to show who added a transaction), if known. */
export function memberEmail(db: LocalDb, userId: string): string | undefined {
  return db.select({ email: accountMembers.email }).from(accountMembers).where(eq(accountMembers.userId, userId)).get()?.email;
}

/**
 * After a pull: for every shared account this user no longer belongs to
 * (left or removed), drop other people's data for it from this device. Their
 * rows are no longer visible on the server, so pull would never delete them.
 * This clears a local cache; nothing is deleted on the server.
 */
export function purgeEndedMemberships(db: LocalDb, userId: string): number {
  const ended = db
    .select({ accountId: accountMembers.accountId })
    .from(accountMembers)
    .where(and(eq(accountMembers.userId, userId), eq(accountMembers.role, 'member'), isNotNull(accountMembers.deletedAt)))
    .all()
    .map((r) => r.accountId);
  if (ended.length === 0) return 0;

  let removed = 0;
  db.transaction((tx) => {
    for (const accountId of ended) {
      const others = tx
        .select({ id: transactions.id })
        .from(transactions)
        .where(and(eq(transactions.accountId, accountId), ne(transactions.userId, userId)))
        .all()
        .map((r) => r.id);
      for (const id of others) {
        const photoIds = tx.select({ id: attachments.id }).from(attachments).where(eq(attachments.transactionId, id)).all().map((a) => a.id);
        for (const photoId of photoIds) tx.delete(attachmentFiles).where(eq(attachmentFiles.attachmentId, photoId)).run();
        tx.delete(attachments).where(eq(attachments.transactionId, id)).run();
        tx.delete(transactions).where(eq(transactions.id, id)).run();
        removed++;
      }
      tx.delete(accounts).where(and(eq(accounts.id, accountId), ne(accounts.userId, userId))).run();
      // Keep my own (ended) membership row so this stays detectable; drop the rest.
      tx.delete(accountMembers).where(and(eq(accountMembers.accountId, accountId), ne(accountMembers.userId, userId))).run();
    }
  });
  notifyChanged('transactions', 'accounts', 'account_members', 'attachments');
  return removed;
}

