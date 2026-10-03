import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, Divider, List, Portal, SegmentedButtons, Switch, Text } from 'react-native-paper';

import { translateError, useT } from '@/i18n/i18n';
import { setLanguage } from '@/i18n/language';
import { JoinSharedAccount } from '@/components/JoinSharedAccount';
import { pendingChangeCount, signOut } from '@/lib/auth/auth';
import { useUser } from '@/lib/auth/store';
import { getDb } from '@/lib/db/client';
import { listTransactions } from '@/lib/db/repositories/transactions';
import { exportTransactions } from '@/lib/export/exportTransactions';
import { canUseAppLock, setAppLock, useLockStore } from '@/lib/lock/lock';
import { REMINDER_TIMES, remindersSupported, setReminder, useReminderStore } from '@/lib/reminder/reminder';
import { syncNow } from '@/lib/sync/syncEngine';
import { showNotice } from '@/store/notice';
import { setThemePreference, useThemeStore, type ThemePreference } from '@/store/theme';

export default function SettingsScreen() {
  const user = useUser();
  const { t, lang } = useT();
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
    <ScrollView>
      <List.Section>
        <List.Subheader>{t('settings.manage')}</List.Subheader>
        <List.Item
          title={t('settings.categories')}
          left={(props) => <List.Icon {...props} icon="shape" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/categories')}
        />
        <List.Item
          title={t('settings.accounts')}
          left={(props) => <List.Icon {...props} icon="wallet" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/accounts')}
        />
        <JoinSharedAccount />
        <List.Item
          title={t('recurring.title')}
          left={(props) => <List.Icon {...props} icon="repeat" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/recurring')}
        />
        <List.Item
          title={t('settings.export')}
          description={exporting ? t('settings.exportPreparing') : t('settings.exportHint')}
          left={(props) => <List.Icon {...props} icon="file-delimited-outline" />}
          onPress={exportAll}
          disabled={exporting}
        />
      </List.Section>
      <Divider />
      <List.Section>
        <List.Subheader>{t('settings.appearance')}</List.Subheader>
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
      </List.Section>
      <Divider />
      <List.Section>
        <List.Subheader>{t('settings.language')}</List.Subheader>
        <SegmentedButtons
          style={styles.segment}
          value={lang}
          onValueChange={(v) => setLanguage(v as 'en' | 'bn')}
          buttons={[
            { value: 'en', label: 'English' },
            { value: 'bn', label: 'বাংলা' },
          ]}
        />
      </List.Section>
      {remindersSupported && (
        <>
          <Divider />
          <List.Section>
            <List.Subheader>{t('settings.reminder')}</List.Subheader>
            <List.Item
              title={t('settings.dailyReminder')}
              description={t('settings.dailyReminderHint')}
              left={(props) => <List.Icon {...props} icon="bell-outline" />}
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
          </List.Section>
        </>
      )}
      {lockAvailable && (
        <>
          <Divider />
          <List.Section>
            <List.Subheader>{t('settings.security')}</List.Subheader>
            <List.Item
              title={t('settings.appLock')}
              description={t('settings.appLockHint')}
              left={(props) => <List.Icon {...props} icon="lock" />}
              right={() => <Switch value={lockEnabled} onValueChange={(v) => void toggleLock(v)} />}
            />
          </List.Section>
        </>
      )}
      <Divider />
      <List.Section>
        <List.Subheader>{t('settings.account')}</List.Subheader>
        <List.Item title={user.email} description={t('settings.signedIn')} left={(props) => <List.Icon {...props} icon="account" />} />
        <List.Item
          title={t('settings.signOut')}
          description={busy && !confirm ? t('settings.syncingFirst') : undefined}
          left={(props) => <List.Icon {...props} icon="logout" />}
          onPress={askSignOut}
          disabled={busy}
        />
      </List.Section>

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
            <Button onPress={doSignOut} loading={busy} textColor={confirm?.pending ? '#C62828' : undefined}>
              {t('settings.signOut')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  segment: { marginHorizontal: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
});
