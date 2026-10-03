/** How long the app can sit in the background before it locks again. */
export const LOCK_GRACE_MS = 30_000;

/**
 * Whether to lock when the app becomes active. `backgroundedAt` is when it
 * left the foreground (null on a cold start, which always locks).
 */
export function shouldLock(enabled: boolean, backgroundedAt: number | null, now: number): boolean {
  if (!enabled) return false;
  if (backgroundedAt === null) return true;
  return now - backgroundedAt >= LOCK_GRACE_MS;
}
