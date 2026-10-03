import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { initAuth } from '@/lib/auth/auth';
import { useAuthStore } from '@/lib/auth/store';
import { DatabaseGate } from '@/lib/db/DatabaseGate';
import { registerServiceWorker } from '@/lib/pwa';
import { startSync } from '@/lib/sync/syncEngine';
import { darkTheme, lightTheme, navTheme } from '@/theme';

registerServiceWorker();

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const theme = dark ? darkTheme : lightTheme;

  return (
    <PaperProvider theme={theme}>
      <ThemeProvider value={navTheme(theme, dark)}>
        <DatabaseGate>
          <AppStack />
        </DatabaseGate>
        <StatusBar style="auto" />
      </ThemeProvider>
    </PaperProvider>
  );
}

function AppStack() {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.user?.id);
  useEffect(initAuth, []);
  useEffect(() => {
    if (userId) startSync(userId); // signOut() stops it before wiping
  }, [userId]);

  if (status === 'loading') return null;
  const signedIn = status === 'signedIn';

  return (
    <Stack>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="transaction/[id]" options={{ presentation: 'modal', title: 'Transaction' }} />
        <Stack.Screen name="categories/index" />
        <Stack.Screen name="categories/[id]" />
        <Stack.Screen name="accounts/index" />
        <Stack.Screen name="accounts/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
