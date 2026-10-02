import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { Database } from './database.types';

// Only src/lib/sync and src/lib/auth may import this. Screens use the local DB.

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
}

// Native: keep the session in the Keychain / Keystore. Web: supabase-js defaults to localStorage.
const secureStorage: SupportedStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * fetch with a timeout. Without one, a request to an unresponsive server
 * (captive portal, dead connection) hangs forever and blocks every later sync.
 */
const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Network request timed out')), REQUEST_TIMEOUT_MS);
  init?.signal?.addEventListener('abort', () => controller.abort(init.signal?.reason));
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};

export const supabase = createClient<Database>(url, anonKey, {
  global: { fetch: fetchWithTimeout },
  auth: {
    storage: Platform.OS === 'web' ? undefined : secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
