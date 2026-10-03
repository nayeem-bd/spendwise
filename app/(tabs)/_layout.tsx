import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import { type ColorValue, View } from 'react-native';
import { IconButton } from 'react-native-paper';

import type { IconName } from '@/components/IconBadge';
import { SyncBadge } from '@/components/SyncBadge';

const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => <MaterialCommunityIcons name={name} color={color} size={size} />;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerRight: () => <SyncBadge /> }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('chart-pie') }} />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: icon('format-list-bulleted'),
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconButton icon="magnify" accessibilityLabel="Search transactions" onPress={() => router.push('/search')} />
              <SyncBadge />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="budgets" options={{ title: 'Budgets', tabBarIcon: icon('target') }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports', tabBarIcon: icon('chart-bar') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('cog') }} />
    </Tabs>
  );
}
