import { useEffect } from 'react';
import { AppState } from 'react-native';

import { onTablesChanged } from '@/lib/db/changes';

import { loadReminderPrefs, refreshReminders, remindersSupported } from './reminder';

/** Keeps the reminder schedule current while signed in. */
export function useReminders(signedIn: boolean): void {
  useEffect(() => {
    if (!remindersSupported || !signedIn) return;
    loadReminderPrefs();
    void refreshReminders();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const offTables = onTablesChanged((tables) => {
      if (!tables.has('transactions')) return;
      clearTimeout(timer);
      timer = setTimeout(() => void refreshReminders(), 1000); // logging today cancels today's reminder
    });
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refreshReminders();
    });
    return () => {
      clearTimeout(timer);
      offTables();
      sub.remove();
    };
  }, [signedIn]);
}
