import { useEffect, useState } from 'react';

import { getAttachmentData } from '@/lib/db/repositories/attachments';
import { useLocalQuery } from '@/lib/db/useLocalQuery';
import { fetchAttachment } from '@/lib/sync/syncEngine';

/** The photo's base64 data: from this device, or downloaded once if it was taken elsewhere. */
export function useAttachmentData(id: string): { data: string | undefined; failed: boolean } {
  const data = useLocalQuery((db) => getAttachmentData(db, id), ['attachment_files'], [id]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (data) return;
    let cancelled = false;
    setFailed(false);
    fetchAttachment(id).catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id, data]);
  return { data, failed };
}
