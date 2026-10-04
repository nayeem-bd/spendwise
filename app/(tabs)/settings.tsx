import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Button, Chip, Dialog, List, Portal, SegmentedButtons, Switch, Text, useTheme } from 'react-native-paper';

import { translateError, useT } from '@/i18n/i18n';
import { setLanguage } from '@/i18n/language';
import { JoinSharedAccount } from '@/components/JoinSharedAccount';
import { pendingChangeCount, signOut } from '@/lib/auth/auth';
import { useUser } from '@/lib/auth/store';
import { getDb } from '@/lib/db/client';
import { listTransactions } from '@/lib/db/repositories/transactions';
import { exportTransactions } from '@/lib/export/exportTransactions';
import { page } from '@/components/layout';
import { ROW_ICON_INSET, rowIcon, Section } from '@/components/Section';
import { canUseAppLock, setAppLock, useLockStore } from '@/lib/lock/lock';
import { REMINDER_TIMES, remindersSupported, setReminder, useReminderStore } from '@/lib/reminder/reminder';
import { syncNow } from '@/lib/sync/syncEngine';
import { showNotice } from '@/store/notice';
import { setThemePreference, useThemeStore, type ThemePreference } from '@/store/theme';

export default function SettingsScreen() {
  const user = useUser();
  const { t, lang } = useT();
  const { colors } = useTheme();
  const theme = useThemeStore((st) => st.preference);
  const [confirm, setConfirm] = useState<{ pending: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const lockEnabled = useLockStore((st) => st.enabled);
  const [lockAvailable, setLockAvailable] = useState(false);
  useEffect(() => {
    void canUseAppLock().then(setLockAvailable);
  }, []);

  const reminder = useReminderStore();
  const changeReminder = async (prefs: { enabled?: boolean; minutes?: number }) => {
    try {
      await setReminder(prefs);
    } catch (e) {
      showNotice(translateError(e));
    }
  };

  const toggleLock = async (on: boolean) => {
    try {
      await setAppLock(on);
    } catch (e) {
      showNotice(translateError(e));
    }
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      await exportTransactions(listTransactions(getDb(), { limit: 1_000_000 }));
    } catch (e) {
      showNotice(translateError(e));
    } finally {
      setExporting(false);
    }
  };

  const askSignOut = async () => {
    setBusy(true);
    try {
      await syncNow(); // push what we can first, so less is lost
    } finally {
      setBusy(false);
      setConfirm({ pending: pendingChangeCount() });
    }
  };

  const doSignOut = async () => {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={[page.list, styles.content]}>
      <Section title={t('settings.manage')} separators inset={ROW_ICON_INSET}>
        <List.Item
          title={t('settings.categories')}
          left={rowIcon('shape', '#F57C00')}
          right={chevron}
          onPress={() => router.push('/categories')}
        />
        <List.Item
          title={t('settings.accounts')}
          left={rowIcon('wallet', '#1976D2')}
          right={chevron}
          onPress={() => router.push('/accounts')}
        />
        <JoinSharedAccount left={rowIcon('account-multiple-plus', '#00897B')} />
        <List.Item
          title={t('recurring.title')}
          left={rowIcon('repeat', '#7B1FA2')}
          right={chevron}
          onPress={() => router.push('/recurring')}
        />
        <List.Item
          title={t('settings.export')}
          description={exporting ? t('settings.exportPreparing') : t('settings.exportHint')}
          left={rowIcon('file-delimited-outline', '#388E3C')}
          onPress={exportAll}
          disabled={exporting}
        />
      </Section>
      <Section title={t('settings.appearance')}>
        <SegmentedButtons
          style={styles.segment}
          value={theme}
          onValueChange={(v) => setThemePreference(v as ThemePreference)}
          buttons={[
            { value: 'system', label: t('settings.themeSystem'), icon: 'theme-light-dark' },
            { value: 'light', label: t('settings.themeLight'), icon: 'white-balance-sunny' },
            { value: 'dark', label: t('settings.themeDark'), icon: 'weather-night' },
          ]}
        />
      </Section>
      <Section title={t('settings.language')}>
        <SegmentedButtons
          style={styles.segment}
          value={lang}
          onValueChange={(v) => setLanguage(v as 'en' | 'bn')}
          buttons={[
            { value: 'en', label: 'English' },
            { value: 'bn', label: 'বাংলা' },
          ]}
        />
      </Section>
      {remindersSupported && (
        <Section title={t('settings.reminder')}>
          <List.Item
            title={t('settings.dailyReminder')}
            description={t('settings.dailyReminderHint')}
            left={rowIcon('bell-outline', '#E53935')}
            right={() => <Switch value={reminder.enabled} onValueChange={(v) => void changeReminder({ enabled: v })} />}
          />
          {reminder.enabled && (
            <View style={styles.chips}>
              {REMINDER_TIMES.map((m) => (
                <Chip key={m} selected={reminder.minutes === m} showSelectedOverlay onPress={() => void changeReminder({ minutes: m })}>
                  {t(m < 20 * 60 ? 'settings.pmEvening' : 'settings.pmNight', { hour: m / 60 - 12 })}
                </Chip>
              ))}
            </View>
          )}
        </Section>
      )}
      {lockAvailable && (
        <Section title={t('settings.security')}>
          <List.Item
            title={t('settings.appLock')}
            description={t('settings.appLockHint')}
            left={rowIcon('lock', '#546E7A')}
            right={() => <Switch value={lockEnabled} onValueChange={(v) => void toggleLock(v)} />}
          />
        </Section>
      )}
      <Section title={t('settings.account')} separators inset={ROW_ICON_INSET}>
        <List.Item title={user.email} description={t('settings.signedIn')} left={rowIcon('account', '#5C6BC0')} />
        <List.Item
          title={t('settings.signOut')}
          titleStyle={{ color: colors.error }}
          description={busy && !confirm ? t('settings.syncingFirst') : undefined}
          left={rowIcon('logout', '#757575')}
          onPress={askSignOut}
          disabled={busy}
        />
      </Section>

      <Portal>
        <Dialog visible={confirm !== null} onDismiss={() => setConfirm(null)}>
          <Dialog.Title>{t('settings.signOutTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text>
              {confirm && confirm.pending > 0
                ? t(confirm.pending === 1 ? 'settings.signOutPendingOne' : 'settings.signOutPending', { count: confirm.pending })
                : t('settings.signOutSynced')}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirm(null)}>{t('common.cancel')}</Button>
            <Button onPress={doSignOut} loading={busy} textColor={confirm?.pending ? colors.error : undefined}>
              {t('settings.signOut')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const chevron = (props: { color: string; style?: StyleProp<ViewStyle> }) => <List.Icon {...props} icon="chevron-right" />;

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  segment: { margin: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
});
