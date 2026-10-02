import { router, Stack } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { FAB, List, Text } from 'react-native-paper';

import { IconBadge } from '@/components/IconBadge';
import { listAccountsWithBalance } from '@/lib/db/repositories/accounts';
import { useLocalQuery } from '@/lib/db/useLocalQuery';
import { addPoisha, formatBDT } from '@/utils/money';

export default function AccountsScreen() {
  const accounts = useLocalQuery(listAccountsWithBalance, ['accounts', 'transactions']);
  const total = addPoisha(...accounts.map((a) => a.balance));

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Accounts' }} />
      <FlatList
        data={accounts}
        keyExtractor={(a) => a.id}
        ListHeaderComponent={
          <View style={styles.total}>
            <Text variant="labelLarge">Total balance</Text>
            <Text variant="headlineSmall">{formatBDT(total)}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            left={() => <View style={styles.icon}><IconBadge icon={item.icon} color={item.color} /></View>}
            right={() => <Text style={styles.balance}>{formatBDT(item.balance)}</Text>}
            onPress={() => router.push({ pathname: '/accounts/[id]', params: { id: item.id } })}
          />
        )}
        contentContainerStyle={styles.list}
      />
      <FAB icon="plus" label="New account" style={styles.fab} onPress={() => router.push({ pathname: '/accounts/[id]', params: { id: 'new' } })} />
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
