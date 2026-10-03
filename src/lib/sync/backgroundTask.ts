import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { BACKGROUND_SYNC_TASK } from './backgroundRegistration';
import { backgroundSync } from './syncEngine';

// Must run at module load (global scope), before any React code, so the OS
// can find the task when it wakes the app in the background. Imported first
// thing from app/_layout.tsx.
if (Platform.OS !== 'web') {
  TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    try {
      return (await backgroundSync()) ? BackgroundTask.BackgroundTaskResult.Success : BackgroundTask.BackgroundTaskResult.Failed;
    } catch (e) {
      console.warn('Background sync failed', e);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}
