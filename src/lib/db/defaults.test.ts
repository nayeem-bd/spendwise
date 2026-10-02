/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';

import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES } from './defaults';

// The server seeds the same defaults in handle_new_user(). If these drift,
// device and server create different rows for the same user.
const sql = readFileSync(join(__dirname, '../../../supabase/migrations/20261003000000_init.sql'), 'utf8');

const tuples = (block: string) =>
  [...block.matchAll(/\(\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'(?:,\s*'([^']*)',\s*(\d+))?\s*\)/g)].map(
    (m) => m.slice(1).filter((v) => v !== undefined),
  );

const section = (start: string) => {
  const from = sql.indexOf(start);
  return sql.slice(from, sql.indexOf(') as', from));
};

describe('defaults match the server seed', () => {
  it('accounts', () => {
    const server = tuples(section('insert into public.accounts'));
    const device = DEFAULT_ACCOUNTS.map((a) => [a.key, a.name, a.icon, a.color]);
    expect(device).toEqual(server);
  });

  it('categories', () => {
    const server = tuples(section('insert into public.categories'));
    const device = DEFAULT_CATEGORIES.map((c) => [c.key, c.name, c.type, c.icon, c.color, String(c.sortOrder)]);
    expect(device).toEqual(server);
  });
});
