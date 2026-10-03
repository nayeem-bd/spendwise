import type { SyncedTableName } from './schema';

// In-process change notifications. Every write goes through write.ts (and,
// from week 3, the sync pull), which calls notifyChanged after commit.
// useLocalQuery listens so screens re-read the tables they depend on.

export type ChangedTable = SyncedTableName | 'outbox' | 'attachment_files';
type Listener = (tables: ReadonlySet<ChangedTable>) => void;

const listeners = new Set<Listener>();

export function onTablesChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyChanged(...tables: ChangedTable[]) {
  const set = new Set(tables);
  listeners.forEach((l) => l(set));
}
