import type { LocalDb } from './types';

/** True when `e` (or an error it wraps) is SQLite refusing a BEGIN because one is already open. */
export function isNestedBeginError(e: unknown): boolean {
  for (let err: unknown = e; err instanceof Error; err = err.cause) {
    if (/within a transaction/i.test(err.message)) return true;
  }
  return false;
}

/**
 * Makes `db.transaction()` recover from a transaction left open on the
 * connection. On web every query is a synchronous call to the SQLite worker
 * that gives up after 10 s; when iOS suspends the PWA mid-call, the page
 * reports a failure but the worker still runs the statement later. If that
 * was a BEGIN (or the ROLLBACK after a failure), the connection stays inside
 * a transaction and every later write fails with "Failed to run the query
 * 'begin'" until the app is killed.
 *
 * The leftover transaction belongs to a call that already failed, so rolling
 * it back and starting again is safe. It only recovers when BEGIN itself
 * failed (the callback never ran) at the top level: a nested BEGIN inside a
 * running transaction is a real bug and must not discard that work.
 */
export function recoverStuckTransactions<T extends LocalDb>(db: T, rollback: () => void): T {
  const transaction = db.transaction.bind(db);
  let depth = 0;
  db.transaction = ((fn, config) => {
    let began = false;
    let failure: unknown;
    const run = () => {
      depth++;
      failure = undefined;
      try {
        return transaction((tx) => {
          began = true;
          try {
            return fn(tx);
          } catch (e) {
            failure = e;
            throw e;
          }
        }, config);
      } finally {
        depth--;
      }
    };
    try {
      return run();
    } catch (e) {
      // Drizzle throws the failed ROLLBACK instead of the error that caused it; surface the real one.
      if (failure && /query 'rollback'/i.test(String((e as Error)?.message))) throw failure;
      if (began || depth > 0 || !isNestedBeginError(e)) throw e;
      console.warn('Rolling back a transaction left open on the local database', e);
      rollback();
      return run();
    }
  }) as typeof transaction;
  return db;
}
