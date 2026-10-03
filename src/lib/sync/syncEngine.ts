import NetInfo from '@react-native-community/netinfo';
import { countDistinct } from 'drizzle-orm';
import { AppState } from 'react-native';

import { onTablesChanged } from '@/lib/db/changes';
import { getDb } from '@/lib/db/client';
import { materializeRecurring } from '@/lib/db/repositories/recurring';
import { outbox } from '@/lib/db/schema';
import { supabase } from '@/lib/supabase';
import { todayISO } from '@/utils/date';

import { pullAll } from './pull';
import { pushAll } from './push';
import { useSyncStore } from './store';
import { SyncError, supabaseBackend } from './supabaseBackend';

// Runs sync (push, then pull) when:
//  - the engine starts (sign-in / app open) and the app returns to the foreground
//  - the network reconnects
//  - 2 s after a local write (debounced)
//  - syncNow() is called (pull-to-refresh, tapping the badge)
// Failures retry with backoff: 5 s, 30 s, 2 min, then every 10 min.

const WRITE_DEBOUNCE_MS = 2000;
const BACKOFF_MS = [5_000, 30_000, 120_000, 600_000];

let userId: string | null = null;
let running: Promise<void> | null = null;
let rerun = false;
let failures = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let teardown: (() => void)[] = [];

const backend = supabaseBackend(supabase);
const set = useSyncStore.setState;

function refreshPending() {
  const n = getDb().select({ n: countDistinct(outbox.rowId) }).from(outbox).get()?.n ?? 0;
  set({ pending: n });
}

function clearTimers() {
  if (retryTimer) clearTimeout(retryTimer);
  if (debounceTimer) clearTimeout(debounceTimer);
  retryTimer = debounceTimer = null;
}

/** Creates due recurring transactions. Local only, so it runs offline too. */
function runRecurring() {
  try {
    materializeRecurring(getDb(), todayISO());
  } catch (e) {
    console.warn('Recurring transactions failed', e);
  }
}

async function runOnce(forUser: string): Promise<void> {
  runRecurring();
  const net = await NetInfo.fetch();
  if (net.isConnected === false) {
    set({ status: 'offline', error: null });
    return;
  }

  // Refreshes the access token if needed. The local user stays signed in
  // even without a session; only syncing needs one.
  const { data } = await supabase.auth.getSession();
  if (!data.session || data.session.user.id !== forUser) {
    set({ status: 'needsLogin', error: 'Log in again to sync' });
    return;
  }

  // After a failure, keep showing it during retries until one succeeds;
  // flipping to "Syncing…" for each slow attempt would hide that we're offline.
  const { status } = useSyncStore.getState();
  if (status !== 'offline' && status !== 'error') set({ status: 'syncing', error: null });
  const db = getDb();
  try {
    await pushAll(db, backend); // always push before pull
    if (userId !== forUser) return; // signed out meanwhile
    await pullAll(db, backend);
    runRecurring(); // rules or next_run changes may have arrived from another device
    failures = 0;
    set({ status: 'idle', lastSyncedAt: Date.now(), error: null });
  } catch (e) {
    if (userId !== forUser) return;
    const offline = e instanceof SyncError && e.offline;
    set({ status: offline ? 'offline' : 'error', error: e instanceof Error ? e.message : String(e) });
    const delay = BACKOFF_MS[Math.min(failures, BACKOFF_MS.length - 1)]!;
    failures++;
    retryTimer = setTimeout(() => void syncNow(), delay);
  } finally {
    refreshPending();
  }
}

/** Syncs now. Concurrent calls share the running sync and queue one more run. */
export function syncNow(): Promise<void> {
  const forUser = userId;
  if (!forUser) return Promise.resolve();
  if (running) {
    rerun = true;
    return running;
  }
  if (retryTimer) clearTimeout(retryTimer);
  running = (async () => {
    do {
      rerun = false;
      await runOnce(forUser);
    } while (rerun && userId === forUser);
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Starts background syncing for the signed-in user. */
export function startSync(forUser: string): void {
  if (userId === forUser) return;
  stopListeners();
  userId = forUser;
  failures = 0;
  refreshPending();

  teardown = [
    onTablesChanged((tables) => {
      if (!tables.has('outbox')) return;
      refreshPending();
      if (running) return; // a sync is already going; its pending refresh will follow
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => void syncNow(), WRITE_DEBOUNCE_MS);
    }),
    NetInfo.addEventListener((state) => {
      if (state.isConnected) void syncNow();
      else set({ status: 'offline' });
    }),
    (() => {
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          supabase.auth.startAutoRefresh();
          void syncNow();
        } else {
          supabase.auth.stopAutoRefresh();
        }
      });
      return () => sub.remove();
    })(),
  ];
  supabase.auth.startAutoRefresh();
  void syncNow();
}

function stopListeners() {
  teardown.forEach((off) => off());
  teardown = [];
  clearTimers();
}

/** Stops syncing and waits for an in-flight sync, so sign-out can wipe safely. */
export async function stopSync(): Promise<void> {
  userId = null;
  stopListeners();
  supabase.auth.stopAutoRefresh();
  await running?.catch(() => undefined);
  set({ status: 'idle', pending: 0, lastSyncedAt: null, error: null });
}
