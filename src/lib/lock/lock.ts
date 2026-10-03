import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

import { translate } from '@/i18n/i18n';
import { getDb } from '@/lib/db/client';
import { getMeta, setMeta } from '@/lib/db/meta';

import { shouldLock } from './policy';

// App lock with the device's own authentication: Face ID / fingerprint,
// falling back to the device PIN or pattern. No separate app PIN is stored.
// Native only; web has no equivalent API.

const KEY = 'appLock'; // device preference (kept on sign-out)

type LockState = { enabled: boolean; locked: boolean; authenticating: boolean };
export const useLockStore = create<LockState>(() => ({ enabled: false, locked: false, authenticating: false }));

let backgroundedAt: number | null = null;
let listening = false;

/** True when this device can lock the app (has biometrics or at least a PIN/pattern). */
export async function canUseAppLock(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) > LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

async function authenticate(promptMessage: string): Promise<boolean> {
  useLockStore.setState({ authenticating: true });
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, disableDeviceFallback: false });
    return result.success;
  } finally {
    useLockStore.setState({ authenticating: false });
  }
}

/** Reads the setting once the DB is open and locks on a cold start if enabled. */
export function initAppLock(): void {
  if (Platform.OS === 'web') return;
  const enabled = getMeta(getDb(), KEY) === 'on';
  useLockStore.setState({ enabled, locked: shouldLock(enabled, null, Date.now()) });
  if (listening) return;
  listening = true;
  AppState.addEventListener('change', (state) => {
    const { enabled: on, authenticating } = useLockStore.getState();
    // The system auth prompt itself moves the app to 'inactive'; ignore that.
    if (authenticating) return;
    if (state === 'background') backgroundedAt = Date.now();
    if (state === 'active' && backgroundedAt !== null) {
      if (shouldLock(on, backgroundedAt, Date.now())) useLockStore.setState({ locked: true });
      backgroundedAt = null;
    }
  });
}

export async function unlock(): Promise<void> {
  if (await authenticate(translate('lock.prompt'))) useLockStore.setState({ locked: false });
}

/** Turning the lock on or off both require authenticating first. Returns the new state. */
export async function setAppLock(enabled: boolean): Promise<boolean> {
  if (enabled && !(await canUseAppLock())) throw new Error('Set up a screen lock (PIN, fingerprint or Face ID) on this device first.');
  if (!(await authenticate(translate(enabled ? 'lock.turnOn' : 'lock.turnOff')))) return useLockStore.getState().enabled;
  setMeta(getDb(), KEY, enabled ? 'on' : 'off');
  useLockStore.setState({ enabled });
  return enabled;
}
