import { downloadAttachment, uploadPendingAttachments, type AttachmentStore } from '@/lib/sync/attachments';
import { pullAll } from '@/lib/sync/pull';
import { pushAll } from '@/lib/sync/push';
import { FakeServer } from '@/test/fakeServer';
import { createTestDb } from '@/test/testDb';
import { bytesToBase64 } from '@/utils/base64';
import type { Poisha } from '@/utils/money';

import { defaultRowId } from '../defaults';
import { seedDefaults } from '../seed';
import type { LocalDb } from '../types';
import {
  addAttachment,
  getAttachmentData,
  listAttachments,
  MAX_ATTACHMENT_BYTES,
  pendingUploadIds,
} from './attachments';
import { deleteTransaction, saveTransaction } from './transactions';

const USER = '11111111-1111-1111-1111-111111111111';
const photo = bytesToBase64(Uint8Array.from({ length: 3000 }, (_, i) => i % 256));

class FakeStore implements AttachmentStore {
  files = new Map<string, Uint8Array>();
  failNext = false;
  async upload(path: string, bytes: Uint8Array) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('network down');
    }
    this.files.set(path, bytes);
  }
  async download(path: string) {
    const f = this.files.get(path);
    if (!f) throw new Error('not found');
    return f;
  }
}

const newDevice = () => {
  const db = createTestDb();
  seedDefaults(db, USER);
  return db;
};
const expense = (db: LocalDb) =>
  saveTransaction(db, USER, {
    type: 'expense',
    amount: 1000 as Poisha,
    categoryId: defaultRowId(USER, 'category', 'food'),
    accountId: defaultRowId(USER, 'account', 'cash'),
    note: null,
    occurredOn: '2026-10-03',
  });

let db: LocalDb;
beforeEach(() => {
  db = newDevice();
});

it('stores the photo locally as pending and the metadata as a synced row', () => {
  const tx = expense(db);
  const a = addAttachment(db, USER, tx.id, photo);
  expect(a).toMatchObject({ transactionId: tx.id, storagePath: `${USER}/${a.id}.jpg`, sizeBytes: 3000 });
  expect(getAttachmentData(db, a.id)).toBe(photo);
  expect(pendingUploadIds(db)).toEqual([a.id]);
});

it('rejects empty and oversized photos', () => {
  const tx = expense(db);
  expect(() => addAttachment(db, USER, tx.id, '')).toThrow('That photo could not be read');
  const huge = bytesToBase64(new Uint8Array(MAX_ATTACHMENT_BYTES + 1));
  expect(() => addAttachment(db, USER, tx.id, huge)).toThrow('That photo is too large');
  expect(listAttachments(db, tx.id)).toHaveLength(0);
});

it('deleting a transaction deletes its photos', () => {
  const tx = expense(db);
  const a = addAttachment(db, USER, tx.id, photo);
  deleteTransaction(db, tx.id);
  expect(listAttachments(db, tx.id)).toHaveLength(0);
  expect(getAttachmentData(db, a.id)).toBeUndefined();
});

it('uploads pending photos once, and keeps them pending if the upload fails', async () => {
  const store = new FakeStore();
  const a = addAttachment(db, USER, expense(db).id, photo);

  store.failNext = true;
  await expect(uploadPendingAttachments(db, store)).rejects.toThrow('network down');
  expect(pendingUploadIds(db)).toEqual([a.id]);

  expect(await uploadPendingAttachments(db, store)).toBe(1);
  expect(store.files.get(a.storagePath)?.length).toBe(3000);
  expect(await uploadPendingAttachments(db, store)).toBe(0);
});

it('another device gets the row by sync and the photo on demand, then keeps it offline', async () => {
  const server = new FakeServer();
  const store = new FakeStore();
  const tx = expense(db);
  const a = addAttachment(db, USER, tx.id, photo);
  await uploadPendingAttachments(db, store);
  await pushAll(db, server.backend());

  const phoneB = newDevice();
  await pullAll(phoneB, server.backend());
  expect(listAttachments(phoneB, tx.id).map((x) => x.id)).toEqual([a.id]);
  expect(getAttachmentData(phoneB, a.id)).toBeUndefined();

  expect(await downloadAttachment(phoneB, store, a.id)).toBe(photo);
  store.files.clear(); // "offline": the cached copy is used
  expect(await downloadAttachment(phoneB, store, a.id)).toBe(photo);
  expect(pendingUploadIds(phoneB)).toEqual([]); // downloaded copies are not re-uploaded
});
