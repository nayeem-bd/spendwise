import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'needsLogin';

type SyncState = {
  status: SyncStatus;
  /** Rows waiting in the outbox. */
  pending: number;
  lastSyncedAt: number | null;
  error: string | null;
};

export const useSyncStore = create<SyncState>(() => ({ status: 'idle', pending: 0, lastSyncedAt: null, error: null }));
