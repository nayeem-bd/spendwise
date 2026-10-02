import type { SyncedTableName } from '@/lib/db/schema';

import type { ServerRow } from './mapping';

export type Change = { table: SyncedTableName; row: ServerRow };
export type PushResult = Partial<Record<SyncedTableName, ServerRow[]>>;

/** What the sync engine needs from the server. Supabase in the app, a fake in tests. */
export interface SyncBackend {
  /** Applies changes in one transaction (LWW) and returns the current server row for each id. */
  pushChanges(changes: Change[]): Promise<PushResult>;
  /** Rows with server_seq > since, ordered by server_seq. */
  pullChanges(table: SyncedTableName, since: number, limit: number): Promise<ServerRow[]>;
}
