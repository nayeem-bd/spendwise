import { and, asc, eq, isNull } from 'drizzle-orm';

import { base64Size } from '@/utils/base64';

import { notifyChanged } from '../changes';
import { newId } from '../id';
import { attachmentFiles, attachments, type Attachment } from '../schema';
import type { LocalDb } from '../types';
import { softDeleteRow, upsertRow } from '../write';
import { ValidationError } from './validate';

// Receipt photos. The synced `attachments` row is metadata; the JPEG itself
// is kept on the device in attachment_files ('pending' until uploaded by
// sync) and in Supabase Storage at <user_id>/<attachment_id>.jpg.

export const MAX_ATTACHMENT_BYTES = 700 * 1024; // keeps each row well under web's ~1 MB sync read limit

export function addAttachment(db: LocalDb, userId: string, transactionId: string, base64Jpeg: string): Attachment {
  const sizeBytes = base64Size(base64Jpeg);
  if (sizeBytes === 0) throw new ValidationError('That photo could not be read');
  if (sizeBytes > MAX_ATTACHMENT_BYTES) throw new ValidationError('That photo is too large');
  const id = newId();
  db.insert(attachmentFiles).values({ attachmentId: id, data: base64Jpeg, state: 'pending' }).run();
  try {
    return upsertRow(db, attachments, {
      id,
      userId,
      transactionId,
      storagePath: `${userId}/${id}.jpg`,
      contentType: 'image/jpeg',
      sizeBytes,
    });
  } catch (e) {
    db.delete(attachmentFiles).where(eq(attachmentFiles.attachmentId, id)).run();
    throw e;
  }
}

export function listAttachments(db: LocalDb, transactionId: string): Attachment[] {
  return db
    .select()
    .from(attachments)
    .where(and(eq(attachments.transactionId, transactionId), isNull(attachments.deletedAt)))
    .orderBy(asc(attachments.createdAt))
    .all();
}

export function getAttachment(db: LocalDb, id: string): Attachment | undefined {
  return db.select().from(attachments).where(eq(attachments.id, id)).get();
}

/** The photo's base64 data if it's on this device. One row per query (web read limit). */
export function getAttachmentData(db: LocalDb, id: string): string | undefined {
  return db.select({ data: attachmentFiles.data }).from(attachmentFiles).where(eq(attachmentFiles.attachmentId, id)).get()?.data;
}

/** Soft-deletes the photo. The local copy is dropped; the Storage file stays (see sync/attachments.ts). */
export function deleteAttachment(db: LocalDb, id: string): void {
  softDeleteRow(db, attachments, id);
  db.delete(attachmentFiles).where(eq(attachmentFiles.attachmentId, id)).run();
  notifyChanged('attachment_files');
}

/** Soft-deletes every photo of a transaction (when the transaction is deleted). */
export function deleteAttachmentsOf(db: LocalDb, transactionId: string): void {
  for (const a of listAttachments(db, transactionId)) deleteAttachment(db, a.id);
}

/** Ids of photos taken on this device that still need uploading. */
export function pendingUploadIds(db: LocalDb): string[] {
  return db
    .select({ id: attachmentFiles.attachmentId })
    .from(attachmentFiles)
    .where(eq(attachmentFiles.state, 'pending'))
    .all()
    .map((r) => r.id);
}

export function markUploaded(db: LocalDb, id: string): void {
  db.update(attachmentFiles).set({ state: 'synced' }).where(eq(attachmentFiles.attachmentId, id)).run();
  notifyChanged('attachment_files');
}

/** Stores a photo downloaded from Storage so it's available offline. */
export function saveDownloaded(db: LocalDb, id: string, base64: string): void {
  db.insert(attachmentFiles)
    .values({ attachmentId: id, data: base64, state: 'synced' })
    .onConflictDoNothing()
    .run();
  notifyChanged('attachment_files');
}
