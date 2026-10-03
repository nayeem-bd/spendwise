import { getDb } from '@/lib/db/client';
import { syncState } from '@/lib/db/schema';
import { supabase } from '@/lib/supabase';

import { SyncError } from './supabaseBackend';
import { syncNow } from './syncEngine';

// Shared wallet actions. They change membership on the server (RPCs), then
// sync so this device sees the result. All need internet.

async function rpc<T>(run: () => PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  let result;
  try {
    result = await run();
  } catch (e) {
    throw new SyncError(e instanceof Error ? e.message : String(e), true);
  }
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

/** Owner: a code someone else can use to join this account (valid 7 days). */
export async function createInvite(accountId: string): Promise<string> {
  const code = await rpc(() => supabase.rpc('create_account_invite', { p_account: accountId }));
  await syncNow(); // pull the owner's membership row
  return code;
}

/**
 * Joins the account behind a code. The shared account's history was written
 * before this device could see it (below its last_seq), so start pull from
 * zero to download everything once.
 */
export async function joinWithCode(code: string): Promise<void> {
  await rpc(() => supabase.rpc('join_account', { p_code: code }));
  getDb().delete(syncState).run();
  await syncNow();
}

export async function leaveSharedAccount(accountId: string): Promise<void> {
  await rpc(() => supabase.rpc('leave_account', { p_account: accountId }));
  await syncNow(); // the pull sees the ended membership and clears the shared data
}

export async function removeMember(accountId: string, userId: string): Promise<void> {
  await rpc(() => supabase.rpc('remove_account_member', { p_account: accountId, p_user: userId }));
  await syncNow();
}
