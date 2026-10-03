import { and, count, eq, isNull } from 'drizzle-orm';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { translate } from '@/i18n/i18n';
import { getDb } from '@/lib/db/client';
import { getMeta, setMeta } from '@/lib/db/meta';
import { transactions } from '@/lib/db/schema';
import { todayISO } from '@/utils/date';

import { atLocalTime, reminderDays } from './schedule';

// Daily "did you log today?" reminder. Instead of one repeating alarm, the
// next 14 days are scheduled as one-off notifications and today is skipped
// once something is logged; the schedule is refreshed on app start,
// foreground and after saving a transaction. Native only.

const KEY = 'reminder'; // device preference (kept on sign-out)
const ID_PREFIX = 'daily-reminder-';
const CHANNEL = 'reminders';

export const REMINDER_TIMES = [19 * 60, 20 * 60, 21 * 60, 22 * 60];

type ReminderPrefs = { enabled: boolean; minutes: number };
export const useReminderStore = create<ReminderPrefs>(() => ({ enabled: false, minutes: 21 * 60 }));

export const remindersSupported = Platform.OS !== 'web';

if (remindersSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

export function loadReminderPrefs(): void {
  const raw = getMeta(getDb(), KEY);
  if (!raw) return;
  try {
    const prefs = JSON.parse(raw) as Partial<ReminderPrefs>;
    useReminderStore.setState({ enabled: prefs.enabled === true, minutes: prefs.minutes ?? 21 * 60 });
  } catch {
    // ignore a malformed preference
  }
}

function loggedToday(): boolean {
  const n = getDb()
    .select({ n: count() })
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), eq(transactions.occurredOn, todayISO())))
    .get()?.n;
  return (n ?? 0) > 0;
}

async function cancelAll(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled.filter((n) => n.identifier.startsWith(ID_PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

let refreshing: Promise<void> | null = null;

/** Re-creates the upcoming reminders from the current settings and today's entries. */
export function refreshReminders(): Promise<void> {
  if (!remindersSupported) return Promise.resolve();
  refreshing ??= (async () => {
    try {
      await cancelAll();
      const { enabled, minutes } = useReminderStore.getState();
      if (!enabled) return;
      const now = new Date();
      const days = reminderDays(todayISO(now), now.getHours() * 60 + now.getMinutes(), loggedToday(), minutes);
      for (const day of days) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${ID_PREFIX}${day}`,
          content: { title: 'SpendWise', body: translate('reminder.body') },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: atLocalTime(day, minutes), channelId: CHANNEL },
        });
      }
    } catch (e) {
      console.warn('Scheduling reminders failed', e);
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Turns the reminder on/off or changes its time. Asks for notification permission when turning on. */
export async function setReminder(prefs: Partial<ReminderPrefs>): Promise<void> {
  const next = { ...useReminderStore.getState(), ...prefs };
  if (prefs.enabled) {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: translate('settings.dailyReminder'),
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const { granted } = await Notifications.requestPermissionsAsync();
    if (!granted) throw new Error('Allow notifications for SpendWise in your phone settings to get reminders.');
  }
  setMeta(getDb(), KEY, JSON.stringify(next));
  useReminderStore.setState(next);
  await refreshReminders();
}

/** Sign-out: stop reminding on this device (the preference itself is kept). */
export async function cancelReminders(): Promise<void> {
  if (remindersSupported) await cancelAll().catch(() => undefined);
}
