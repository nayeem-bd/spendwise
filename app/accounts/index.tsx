import { router, Stack } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { FAB, List, Text } from 'react-native-paper';

import { IconBadge } from '@/components/IconBadge';
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
            <Text variant="labelLarge">{t('account.totalBalance')}</Text>
            <Text variant="headlineSmall">{f.money(total)}</Text>
          </View>
        }
        renderItem={({ item }) => (
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
        )}
        contentContainerStyle={[page.list, styles.list]}
      />
      <FAB icon="plus" label={t('account.new')} style={styles.fab} onPress={() => router.push({ pathname: '/accounts/[id]', params: { id: 'new' } })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  total: { padding: 16, gap: 4 },
  icon: { marginLeft: 16, justifyContent: 'center' },
  balance: { alignSelf: 'center', fontVariant: ['tabular-nums'] },
  list: { paddingBottom: 96 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
