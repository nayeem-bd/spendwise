import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { DatabaseGate } from '@/lib/db/DatabaseGate';

export default function RootLayout() {
  return (
    <DatabaseGate>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="transaction/[id]" options={{ presentation: 'modal', title: 'Transaction' }} />
      </Stack>
      <StatusBar style="auto" />
    </DatabaseGate>
  );
}
