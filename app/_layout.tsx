// Defines the OS background sync task; must load before anything else.
import '@/lib/sync/backgroundTask';

import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { initAuth } from '@/lib/auth/auth';
import { useAuthStore } from '@/lib/auth/store';
import { DatabaseGate } from '@/lib/db/DatabaseGate';
import { useT } from '@/i18n/i18n';
import { loadLanguage } from '@/i18n/language';
import { initAppLock } from '@/lib/lock/lock';
import { useReminders } from '@/lib/reminder/useReminders';
import { LockScreen } from '@/components/LockScreen';
import { NoticeSnackbar } from '@/components/NoticeSnackbar';
import { UpdateSnackbar } from '@/components/UpdateSnackbar';
import { registerServiceWorker } from '@/lib/pwa';
import { startSync } from '@/lib/sync/syncEngine';
import { loadThemePreference, useThemeStore } from '@/store/theme';
import { darkTheme, lightTheme, navTheme } from '@/theme';

registerServiceWorker();

export default function RootLayout() {
  const system = useColorScheme();
  const preference = useThemeStore((st) => st.preference);
  const dark = preference === 'system' ? system === 'dark' : preference === 'dark';
  const theme = dark ? darkTheme : lightTheme;

  return (
    <PaperProvider theme={theme}>
      <ThemeProvider value={navTheme(theme, dark)}>
        {/* Themed backdrop so the loading screen doesn't flash white in dark mode. */}
        <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
          <DatabaseGate>
            <AppStack />
            <LockScreen />
          </DatabaseGate>
        </View>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <UpdateSnackbar />
        <NoticeSnackbar />
      </ThemeProvider>
    </PaperProvider>
  );
}

function AppStack() {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.user?.id);
  useEffect(() => {
    loadThemePreference();
    loadLanguage();
    initAppLock();
    initAuth();
  }, []);
  useEffect(() => {
    if (userId) startSync(userId); // signOut() stops it before wiping
  }, [userId]);

  useReminders(status === 'signedIn');
  const { t } = useT();

  if (status === 'loading') return null;
  const signedIn = status === 'signedIn';

  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerTitleStyle: styles.headerTitle }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="transaction/[id]" options={{ presentation: 'modal', title: t('transaction.title') }} />
        <Stack.Screen name="categories/index" />
        <Stack.Screen name="categories/[id]" />
        <Stack.Screen name="accounts/index" />
        <Stack.Screen name="accounts/[id]" />
        <Stack.Screen name="budget/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="recurring/index" />
        <Stack.Screen name="recurring/[id]" />
        <Stack.Screen name="search" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerTitle: { fontWeight: '600' },
});
