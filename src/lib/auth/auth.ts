import { count } from 'drizzle-orm';

import { getDb } from '@/lib/db/client';
import { getMeta, setMeta } from '@/lib/db/meta';
import { outbox } from '@/lib/db/schema';
import { seedDefaults } from '@/lib/db/seed';
import { wipeLocalData } from '@/lib/db/wipe';
import { supabase } from '@/lib/supabase';

import { useAuthStore, type LocalUser } from './store';

// Auth is the one place besides src/lib/sync that talks to Supabase.
// The signed-in user is also saved in the local DB, so the app opens and
// works offline even when the Supabase session has expired; the session is
// only needed for sync (week 3).

const USER_KEY = 'user';

export class AuthError extends Error {}

function readLocalUser(): LocalUser | null {
  const raw = getMeta(getDb(), USER_KEY);
  return raw ? (JSON.parse(raw) as LocalUser) : null;
}

/** Restores the signed-in state from the local DB. Works offline. */
export function initAuth(): void {
  const user = readLocalUser();
  useAuthStore.setState(user ? { status: 'signedIn', user } : { status: 'signedOut', user: null });
}

function completeSignIn(user: LocalUser) {
  const db = getDb();
  const previous = readLocalUser();
  // Never mix two users' data on one device.
  if (previous && previous.id !== user.id) wipeLocalData(db);
  setMeta(db, USER_KEY, JSON.stringify(user));
  seedDefaults(db, user.id);
  useAuthStore.setState({ status: 'signedIn', user });
}

function friendly(error: { message: string; name?: string }): AuthError {
  if (/fetch|network/i.test(error.message) || error.name === 'AuthRetryableFetchError') {
    return new AuthError("Can't reach the server. Check your internet connection.");
  }
  return new AuthError(error.message);
}

export async function signIn(email: string, password: string): Promise<void> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw friendly(error);
  completeSignIn({ id: data.user.id, email: data.user.email ?? email.trim() });
}

/** Returns 'confirmEmail' when the project requires email confirmation first. */
export async function signUp(email: string, password: string): Promise<'signedIn' | 'confirmEmail'> {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) throw friendly(error);
  if (!data.session || !data.user) return 'confirmEmail';
  completeSignIn({ id: data.user.id, email: data.user.email ?? email.trim() });
  return 'signedIn';
}

export function pendingChangeCount(): number {
  return getDb().select({ n: count() }).from(outbox).get()?.n ?? 0;
}

/**
 * Signs out and wipes local data. Callers must confirm with the user first
 * when pendingChangeCount() > 0, because those changes are lost.
 */
export async function signOut(): Promise<void> {
  // Removes the stored session even if the server can't be reached.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  wipeLocalData(getDb());
  useAuthStore.setState({ status: 'signedOut', user: null });
}
