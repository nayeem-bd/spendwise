import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

export const BACKGROUND_SYNC_TASK = 'spendwise-background-sync';

/** Asks the OS to run sync about every 15 minutes (iOS decides when; often less). Native only. */
export async function registerBackgroundSync(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return; // e.g. Low Power Mode, iOS simulator
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)) return;
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, { minimumInterval: 15 });
  } catch (e) {
    console.warn('Background sync registration failed', e);
  }
}

export async function unregisterBackgroundSync(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)) {
      await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    }
  } catch (e) {
    console.warn('Background sync unregistration failed', e);
  }
}
