import { create } from 'zustand';

import { getDb } from '@/lib/db/client';
import { getMeta, setMeta } from '@/lib/db/meta';

const KEY = 'hideAmounts'; // a device preference: kept on sign-out (see DEVICE_META_KEYS)

/** Hide amounts on screen, for opening the app in public (Money Lover's eye toggle). */
export const usePrivacyStore = create<{ hidden: boolean }>(() => ({ hidden: false }));

export function loadPrivacyPreference(): void {
  usePrivacyStore.setState({ hidden: getMeta(getDb(), KEY) === '1' });
}

export function toggleHideAmounts(): void {
  const hidden = !usePrivacyStore.getState().hidden;
  setMeta(getDb(), KEY, hidden ? '1' : '0');
  usePrivacyStore.setState({ hidden });
}
