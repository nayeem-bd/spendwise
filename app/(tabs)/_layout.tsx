import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import { type ColorValue, View } from 'react-native';
import { IconButton } from 'react-native-paper';

import type { IconName } from '@/components/IconBadge';
import { useT } from '@/i18n/i18n';
import { SyncBadge } from '@/components/SyncBadge';
import { useWindowClass } from '@/components/layout';
import { haptic } from '@/lib/haptics';
import { toggleHideAmounts, usePrivacyStore } from '@/store/privacy';

// Filled when selected, outlined otherwise (iOS SF Symbols / Material 3 nav bar convention).
const icon =
  (active: IconName, inactive: IconName) =>
  ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <MaterialCommunityIcons name={focused ? active : inactive} color={color} size={size} />
  );

export default function TabsLayout() {
  const { t } = useT();
  const { compact, expanded } = useWindowClass();
  return (
    <Tabs
      screenListeners={{ tabPress: () => haptic('select') }}
      screenOptions={{
        headerRight: () => <SyncBadge />,
        // Flat bars on the screen background, with a bold title, like native tab roots.
        headerShadowVisible: false,
        headerTitleStyle: { fontSize: 22, fontWeight: '700' },
        // Phones: bottom bar. Tablets: navigation rail. Desktop: sidebar with labels.
        tabBarPosition: compact ? 'bottom' : 'left',
        tabBarVariant: compact ? 'uikit' : 'material',
        tabBarLabelPosition: compact ? 'below-icon' : expanded ? 'beside-icon' : 'below-icon',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: icon('chart-pie', 'chart-pie-outline'),
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <HideAmountsButton />
              <SyncBadge />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: t('tabs.transactions'),
          tabBarIcon: icon('receipt-text', 'receipt-text-outline'),
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconButton icon="magnify" accessibilityLabel={t('search.title')} onPress={() => router.push('/search')} />
              <SyncBadge />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="budgets" options={{ title: t('tabs.budgets'), tabBarIcon: icon('piggy-bank', 'piggy-bank-outline') }} />
      <Tabs.Screen name="reports" options={{ title: t('tabs.reports'), tabBarIcon: icon('chart-box', 'chart-box-outline') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings'), tabBarIcon: icon('cog', 'cog-outline') }} />
    </Tabs>
  );
}

function HideAmountsButton() {
  const { t } = useT();
  const hidden = usePrivacyStore((s) => s.hidden);
  return (
    <IconButton
      icon={hidden ? 'eye-off-outline' : 'eye-outline'}
      accessibilityLabel={t(hidden ? 'privacy.show' : 'privacy.hide')}
      accessibilityState={{ selected: hidden }}
      onPress={() => {
        haptic('select');
        toggleHideAmounts();
      }}
    />
  );
}
