import { createTestDb } from '@/test/testDb';
import type { Poisha } from '@/utils/money';

import { defaultRowId } from '../defaults';
import { accountMembers, accounts, categories, transactions } from '../schema';
import { seedDefaults } from '../seed';
import type { LocalDb } from '../types';
import { listAccounts } from './accounts';
import { listCategories } from './categories';
import { listMembers, memberEmail, purgeEndedMemberships } from './sharing';
import { listTransactions, saveTransaction } from './transactions';

const ME = 'bbbbbbbb-0000-0000-0000-000000000002';
const OWNER = 'aaaaaaaa-0000-0000-0000-000000000001';
const SHARED = defaultRowId(OWNER, 'account', 'cash');

let db: LocalDb;
const now = '2026-10-03T10:00:00.000Z';

// Simulates what a pull delivers after joining OWNER's Cash account.
function receiveSharedAccount() {
  db.insert(accounts).values({ id: SHARED, userId: OWNER, name: 'Cash', createdAt: now, updatedAt: now, serverSeq: 1 }).run();
  db.insert(categories)
    .values({ id: 'c-owner', userId: OWNER, name: 'Groceries', type: 'expense', createdAt: now, updatedAt: now, serverSeq: 2 })
    .run();
  db.insert(transactions)
    .values({ id: 't-owner', userId: OWNER, accountId: SHARED, categoryId: 'c-owner', type: 'expense', amount: 500 as Poisha, occurredOn: '2026-10-03', createdAt: now, updatedAt: now, serverSeq: 3 })
    .run();
  db.insert(accountMembers)
    .values([
      { id: 'm-owner', userId: OWNER, accountId: SHARED, email: 'owner@test', role: 'owner', createdAt: now, updatedAt: now, serverSeq: 4 },
      { id: 'm-me', userId: ME, accountId: SHARED, email: 'me@test', role: 'member', createdAt: now, updatedAt: now, serverSeq: 5 },
    ])
    .run();
}

beforeEach(() => {
  db = createTestDb();
  seedDefaults(db, ME);
  receiveSharedAccount();
});

it('lists members owner first and finds co-members by id', () => {
  expect(listMembers(db, SHARED).map((m) => [m.email, m.role])).toEqual([
    ['owner@test', 'owner'],
    ['me@test', 'member'],
  ]);
  expect(memberEmail(db, OWNER)).toBe('owner@test');
});

it('pickers only offer my own categories, while the shared transaction keeps its label', () => {
  expect(listCategories(db, 'expense', ME).some((c) => c.userId === OWNER)).toBe(false);
  expect(listCategories(db, 'expense').some((c) => c.userId === OWNER)).toBe(true);
  expect(listTransactions(db).find((t) => t.id === 't-owner')?.categoryName).toBe('Groceries');
});

it('does nothing while the membership is active', () => {
  expect(purgeEndedMemberships(db, ME)).toBe(0);
  expect(listTransactions(db)).toHaveLength(1);
});

it("after leaving, removes others' shared data but keeps mine", () => {
  const mine = saveTransaction(db, ME, {
    type: 'expense',
    amount: 100 as Poisha,
    categoryId: defaultRowId(ME, 'category', 'food'),
    accountId: SHARED,
    note: 'mine on shared',
    occurredOn: '2026-10-03',
  });
  db.update(accountMembers).set({ deletedAt: now }).run(); // the pull brings my ended membership

  expect(purgeEndedMemberships(db, ME)).toBe(1);
  expect(listTransactions(db).map((t) => t.id)).toEqual([mine.id]);
  expect(listAccounts(db).some((a) => a.id === SHARED)).toBe(false);
  expect(listMembers(db, SHARED)).toEqual([]);
  expect(db.select().from(accountMembers).all().map((m) => m.userId)).toEqual([ME]); // still detectable
});
