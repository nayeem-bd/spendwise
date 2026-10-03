import { Platform } from 'react-native';
import { create } from 'zustand';

/** True when a newer deploy has taken over this page and a reload would show it. */
export const usePwaStore = create<{ updateReady: boolean }>(() => ({ updateReady: false }));

/**
 * Registers the service worker (web builds only) so the app shell loads with
 * no internet. Data is already local (SQLite in OPFS); this caches the code.
 * Skipped in development, where Metro serves changing bundles.
 */
export function registerServiceWorker(): void {
  if (Platform.OS !== 'web' || __DEV__) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  // With skipWaiting + clientsClaim a new deploy's worker takes control of
  // open pages, but they keep running the old code until reloaded. Not on the
  // very first install, when there was no previous worker.
  const hadController = navigator.serviceWorker.controller !== null;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) usePwaStore.setState({ updateReady: true });
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e: unknown) => {
      console.warn('Service worker registration failed', e);
    });
  });
}

export function reloadForUpdate(): void {
  window.location.reload();
}
