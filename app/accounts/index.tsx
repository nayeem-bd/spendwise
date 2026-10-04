import { router, Stack } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { FAB, List, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconBadge } from '@/components/IconBadge';
import { CardRow } from '@/components/Section';
import { listAccountsWithBalance } from '@/lib/db/repositories/accounts';
import { useLocalQuery } from '@/lib/db/useLocalQuery';
import { useT } from '@/i18n/i18n';
import { useDisplayName } from '@/i18n/names';
import { useFormat } from '@/i18n/useFormat';
import { useUser } from '@/lib/auth/store';
import { sharingSummary } from '@/lib/db/repositories/sharing';
import { addPoisha } from '@/utils/money';
import { page } from '@/components/layout';

export default function AccountsScreen() {
  const accounts = useLocalQuery(listAccountsWithBalance, ['accounts', 'transactions']);
  const { t } = useT();
  const f = useFormat();
  const name = useDisplayName();
  const user = useUser();
  const shared = useLocalQuery(sharingSummary, ['account_members']);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Your money: accounts others shared with you count in their total, not yours.
  const total = addPoisha(...accounts.filter((a) => a.userId === user.id).map((a) => a.balance));

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('settings.accounts') }} />
      <FlatList
        data={accounts}
        keyExtractor={(a) => a.id}
        ListHeaderComponent={
          <View style={styles.total}>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('account.totalBalance')}
            </Text>
            <Text variant="headlineMedium" style={styles.totalAmount}>
              {f.money(total)}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <CardRow index={index} count={accounts.length}>
            <List.Item
              title={name(item.id, item.name)}
              description={
                item.userId !== user.id
                  ? t('sharing.sharedBy', { email: shared.get(item.id)?.ownerEmail ?? '' })
                  : shared.has(item.id)
                    ? t('sharing.shared')
                    : undefined
              }
              left={() => <View style={styles.icon}><IconBadge icon={item.icon} color={item.color} /></View>}
              right={() => <Text style={styles.balance}>{f.money(item.balance)}</Text>}
              onPress={() => router.push({ pathname: '/accounts/[id]', params: { id: item.id } })}
            />
          </CardRow>
        )}
        contentContainerStyle={[page.list, styles.list]}
      />
      <FAB icon="plus" label={t('account.new')} style={[styles.fab, { bottom: 16 + insets.bottom }]} onPress={() => router.push({ pathname: '/accounts/[id]', params: { id: 'new' } })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  total: { paddingHorizontal: 28, paddingTop: 16, paddingBottom: 16, gap: 4 },
  totalAmount: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  icon: { marginLeft: 16, justifyContent: 'center' },
  balance: { alignSelf: 'center', fontVariant: ['tabular-nums'] },
  list: { paddingBottom: 112 },
  fab: { position: 'absolute', right: 16 },
});
