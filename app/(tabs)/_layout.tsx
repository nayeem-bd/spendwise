import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import { type ColorValue, View } from 'react-native';
import { IconButton } from 'react-native-paper';

import type { IconName } from '@/components/IconBadge';
import { useT } from '@/i18n/i18n';
import { SyncBadge } from '@/components/SyncBadge';

const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => <MaterialCommunityIcons name={name} color={color} size={size} />;

export default function TabsLayout() {
  const { t } = useT();
  return (
    <Tabs screenOptions={{ headerRight: () => <SyncBadge /> }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: icon('chart-pie') }} />
      <Tabs.Screen
        name="transactions"
        options={{
          title: t('tabs.transactions'),
          tabBarIcon: icon('format-list-bulleted'),
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconButton icon="magnify" accessibilityLabel={t('search.title')} onPress={() => router.push('/search')} />
              <SyncBadge />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="budgets" options={{ title: t('tabs.budgets'), tabBarIcon: icon('target') }} />
      <Tabs.Screen name="reports" options={{ title: t('tabs.reports'), tabBarIcon: icon('chart-bar') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings'), tabBarIcon: icon('cog') }} />
    </Tabs>
  );
}
