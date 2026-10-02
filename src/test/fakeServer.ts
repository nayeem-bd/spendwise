import type { SyncedTableName } from '@/lib/db/schema';
import type { Change, PushResult, SyncBackend } from '@/lib/sync/backend';
import type { ServerRow } from '@/lib/sync/mapping';

const MONEY = new Set(['amount', 'initial_balance']);

/**
 * In-memory stand-in for Supabase with the same rules as push_changes:
 * last-write-wins on updated_at, a global server_seq bumped on every write,
 * all-or-nothing pushes, and money returned as numbers (like PostgREST).
 */
export class FakeServer {
  private tables = new Map<SyncedTableName, Map<string, ServerRow>>();
  private seq = 0;
  /** Throw before applying the next push (network failure). */
  failNextPush = false;
  /** Apply the next push, then throw (app killed before it saw the response). */
  failNextPushAfterCommit = false;
  pushCalls: Change[][] = [];

  rows(table: SyncedTableName): ServerRow[] {
    return [...(this.tables.get(table)?.values() ?? [])];
  }

  backend(): SyncBackend {
    return {
      pushChanges: async (changes) => this.push(changes),
      pullChanges: async (table, since, limit) =>
        this.rows(table)
          .filter((r) => (r.server_seq ?? 0) > since)
          .sort((a, b) => (a.server_seq ?? 0) - (b.server_seq ?? 0))
          .slice(0, limit)
          .map((r) => ({ ...r })),
    };
  }

  private push(changes: Change[]): PushResult {
    this.pushCalls.push(changes);
    if (this.failNextPush) {
      this.failNextPush = false;
      throw new Error('network down');
    }
    const result: PushResult = {};
    for (const { table, row } of changes) {
      const rows = this.tables.get(table) ?? new Map<string, ServerRow>();
      this.tables.set(table, rows);
      const existing = rows.get(row.id);
      const wins = !existing || Date.parse(String(existing.updated_at)) <= Date.parse(String(row.updated_at));
      if (wins) {
        const stored: ServerRow = { ...row, server_seq: ++this.seq };
        for (const key of Object.keys(stored)) {
          if (MONEY.has(key) && stored[key] !== null) stored[key] = Number(stored[key]);
        }
        rows.set(row.id, stored);
      }
      (result[table] ??= []).push({ ...rows.get(row.id)! });
    }
    if (this.failNextPushAfterCommit) {
      this.failNextPushAfterCommit = false;
      throw new Error('connection lost after commit');
    }
    return result;
  }
}
