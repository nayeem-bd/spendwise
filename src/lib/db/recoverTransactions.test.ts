import Database from 'better-sqlite3';

import { recoverStuckTransactions } from './recoverTransactions';
import type { LocalDb } from './types';

/**
 * A db whose transaction() works like drizzle's expo-sqlite session: a plain
 * BEGIN / COMMIT, ROLLBACK on error, wrapping SQLite errors in a query error.
 * (drizzle's better-sqlite3 driver nests with savepoints, so it can't get stuck.)
 */
function setup() {
  const client = new Database(':memory:');
  client.exec('CREATE TABLE t (v INTEGER)');
  const run = (q: string) => {
    try {
      client.exec(q);
    } catch (cause) {
      throw Object.assign(new Error(`Failed to run the query '${q}'`), { cause });
    }
  };
  const db = {
    transaction(fn: (tx: unknown) => unknown) {
      run('begin');
      try {
        const result = fn(db);
        run('commit');
        return result;
      } catch (e) {
        run('rollback');
        throw e;
      }
    },
  };
  // The fake implements only transaction(), which is all the wrapper touches.
  recoverStuckTransactions(db as unknown as LocalDb, () => client.exec('ROLLBACK'));
  const insert = (v: number) => db.transaction(() => client.prepare('INSERT INTO t VALUES (?)').run(v));
  const values = () => client.prepare('SELECT v FROM t').pluck().all();
  return { client, db, insert, values };
}

describe('recoverStuckTransactions', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('rolls back a transaction left open and runs the write', () => {
    const { client, insert, values } = setup();
    client.exec('BEGIN'); // a timed-out call left this open
    client.exec('INSERT INTO t VALUES (9)');

    insert(5);

    expect(client.inTransaction).toBe(false);
    expect(values()).toEqual([5]);
  });

  it('works normally when nothing is open', () => {
    const { client, insert, values } = setup();
    insert(3);
    expect(client.inTransaction).toBe(false);
    expect(values()).toEqual([3]);
  });

  it('does not discard work when a transaction is nested by mistake', () => {
    const { client, db, insert, values } = setup();
    expect(() =>
      db.transaction(() => {
        client.prepare('INSERT INTO t VALUES (1)').run();
        insert(2);
      }),
    ).toThrow(/begin/);
    expect(client.inTransaction).toBe(false);
    expect(values()).toEqual([]);
  });

  it('rethrows errors from the write itself', () => {
    const { client, db } = setup();
    expect(() =>
      db.transaction(() => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(client.inTransaction).toBe(false);
  });
});
