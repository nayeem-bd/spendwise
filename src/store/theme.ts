import { create } from 'zustand';

import { getDb } from '@/lib/db/client';
import { getMeta, setMeta } from '@/lib/db/meta';

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'theme'; // a device preference: kept on sign-out (see DEVICE_META_KEYS)
const isPreference = (v: unknown): v is ThemePreference => v === 'system' || v === 'light' || v === 'dark';

export const useThemeStore = create<{ preference: ThemePreference }>(() => ({ preference: 'system' }));

/** Reads the saved preference once the local DB is open. */
export function loadThemePreference(): void {
  const saved = getMeta(getDb(), KEY);
  if (isPreference(saved)) useThemeStore.setState({ preference: saved });
}

export function setThemePreference(preference: ThemePreference): void {
  setMeta(getDb(), KEY, preference);
  useThemeStore.setState({ preference });
}
