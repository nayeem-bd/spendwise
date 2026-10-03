import { countDistinct } from 'drizzle-orm';
import { Platform } from 'react-native';

import { getDb } from '@/lib/db/client';
import { getMeta, setMeta } from '@/lib/db/meta';
import { outbox } from '@/lib/db/schema';
import { seedDefaults } from '@/lib/db/seed';
import { wipeLocalData } from '@/lib/db/wipe';
import { cancelReminders } from '@/lib/reminder/reminder';
import { supabase } from '@/lib/supabase';
import { stopSync } from '@/lib/sync/syncEngine';

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

let listening = false;

/** Restores the signed-in state from the local DB. Works offline. */
export function initAuth(): void {
  const user = readLocalUser();
  useAuthStore.setState(user ? { status: 'signedIn', user } : { status: 'signedOut', user: null });

  if (!listening) {
    listening = true;
    // Opening the email confirmation link on web lands here with a session in
    // the URL (detectSessionInUrl); finish signing in instead of showing login.
    // The client usually reads the URL before we subscribe, so the session
    // arrives as INITIAL_SESSION rather than SIGNED_IN.
    supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') return;
      if (!session || useAuthStore.getState().status !== 'signedOut') return;
      const confirmed = { id: session.user.id, email: session.user.email ?? '' };
      // Defer: supabase-js warns against doing work inside this callback.
      setTimeout(() => {
        if (useAuthStore.getState().status === 'signedOut') completeSignIn(confirmed);
      }, 0);
    });
  }
}

/**
 * Where the confirmation email sends people back to. Web: this site. Native:
 * the hosted web app (the link opens in a browser), from EXPO_PUBLIC_SITE_URL.
 * Supabase only honours URLs on the project's Redirect URLs allow list and
 * otherwise falls back to its Site URL setting.
 */
function emailRedirectUrl(): string | undefined {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/`;
  return process.env.EXPO_PUBLIC_SITE_URL || undefined;
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
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: emailRedirectUrl() },
  });
  if (error) throw friendly(error);
  if (!data.session || !data.user) return 'confirmEmail';
  completeSignIn({ id: data.user.id, email: data.user.email ?? email.trim() });
  return 'signedIn';
}

/**
 * Restores the Supabase session for the user already signed in locally
 * (when it expired or was revoked). Keeps local data and unsynced changes.
 */
export async function reauthenticate(password: string): Promise<void> {
  const local = readLocalUser();
  if (!local) throw new AuthError('Not signed in');
  const { data, error } = await supabase.auth.signInWithPassword({ email: local.email, password });
  if (error) throw friendly(error);
  if (data.user.id !== local.id) {
    await supabase.auth.signOut({ scope: 'local' });
    throw new AuthError('That login belongs to a different account');
  }
}

export function pendingChangeCount(): number {
  return getDb().select({ n: countDistinct(outbox.rowId) }).from(outbox).get()?.n ?? 0;
}

/**
 * Signs out and wipes local data. Callers must confirm with the user first
 * when pendingChangeCount() > 0, because those changes are lost.
 */
export async function signOut(): Promise<void> {
  await stopSync(); // no sync may write after the wipe
  await cancelReminders();
  // Removes the stored session even if the server can't be reached.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  wipeLocalData(getDb());
  useAuthStore.setState({ status: 'signedOut', user: null });
}
