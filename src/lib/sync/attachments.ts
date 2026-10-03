import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { getAttachment, getAttachmentData, markUploaded, pendingUploadIds, saveDownloaded } from '@/lib/db/repositories/attachments';
import type { LocalDb } from '@/lib/db/types';
import { base64ToBytes, bytesToBase64 } from '@/utils/base64';

import { SyncError } from './supabaseBackend';

export const RECEIPTS_BUCKET = 'receipts';

/** Where receipt images live. Supabase Storage in the app, a fake in tests. */
export interface AttachmentStore {
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  download(path: string): Promise<Uint8Array>;
}

/** Uploads photos taken on this device. Runs before push so other devices can download them right away. */
export async function uploadPendingAttachments(db: LocalDb, store: AttachmentStore): Promise<number> {
  let uploaded = 0;
  for (const id of pendingUploadIds(db)) {
    const meta = getAttachment(db, id);
    const data = getAttachmentData(db, id);
    if (!meta || !data) continue;
    await store.upload(meta.storagePath, base64ToBytes(data), meta.contentType);
    markUploaded(db, id);
    uploaded++;
  }
  return uploaded;
}

/** Fetches a photo taken on another device and keeps it for offline use. */
export async function downloadAttachment(db: LocalDb, store: AttachmentStore, id: string): Promise<string | undefined> {
  const existing = getAttachmentData(db, id);
  if (existing) return existing;
  const meta = getAttachment(db, id);
  if (!meta || meta.deletedAt) return undefined;
  const base64 = bytesToBase64(await store.download(meta.storagePath));
  saveDownloaded(db, id, base64);
  return base64;
}

const isNetworkError = (message: string) => /fetch|network|timed? ?out|load failed/i.test(message);

export function supabaseAttachmentStore(client: SupabaseClient<Database>): AttachmentStore {
  const bucket = () => client.storage.from(RECEIPTS_BUCKET);
  return {
    async upload(path, bytes, contentType) {
      // upsert: re-uploading after a crash mid-sync must not fail with "already exists"
      const { error } = await bucket().upload(path, bytes, { contentType, upsert: true });
      if (error) throw new SyncError(`Receipt upload failed: ${error.message}`, isNetworkError(error.message));
    },
    async download(path) {
      const { data, error } = await bucket().download(path);
      if (error || !data) throw new SyncError(`Receipt download failed: ${error?.message ?? 'no data'}`, isNetworkError(error?.message ?? ''));
      return new Uint8Array(await data.arrayBuffer());
    },
  };
}
