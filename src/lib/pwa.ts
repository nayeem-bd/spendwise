import { Platform } from 'react-native';

/**
 * Registers the service worker (web builds only) so the app shell loads with
 * no internet. Data is already local (SQLite in OPFS); this caches the code.
 * Skipped in development, where Metro serves changing bundles.
 */
export function registerServiceWorker(): void {
  if (Platform.OS !== 'web' || __DEV__) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e: unknown) => {
      console.warn('Service worker registration failed', e);
    });
  });
}
