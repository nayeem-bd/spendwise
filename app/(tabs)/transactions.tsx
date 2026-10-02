import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { List, Text, useTheme } from 'react-native-paper';

import { AddButtons } from '@/components/AddButtons';
import { IconBadge } from '@/components/IconBadge';
import { listTransactions } from '@/lib/db/repositories/transactions';
import { useLocalQuery } from '@/lib/db/useLocalQuery';
import { moneyColors } from '@/theme';
import { formatDay } from '@/utils/date';
import { formatBDT } from '@/utils/money';

// Grouping by day and the month filter arrive in week 3.
export default function TransactionsScreen() {
  const items = useLocalQuery((db) => listTransactions(db), ['transactions', 'categories', 'accounts']);
  const colors = moneyColors(useTheme().dark);

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(t) => t.id}
        ListEmptyComponent={<Text style={styles.empty}>No transactions yet. Add your first one below.</Text>}
        renderItem={({ item }) => (
          <List.Item
            title={item.categoryName ?? 'Uncategorized'}
            description={[formatDay(item.occurredOn), item.accountName, item.note].filter(Boolean).join(' · ')}
            left={() => (
              <View style={styles.icon}>
                <IconBadge icon={item.categoryIcon} color={item.categoryColor} />
              </View>
            )}
            right={() => (
              <Text style={[styles.amount, { color: item.type === 'income' ? colors.income : colors.expense }]}>
                {item.type === 'income' ? '+' : '−'}
                {formatBDT(item.amount)}
              </Text>
            )}
            onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })}
          />
        )}
      />
      <AddButtons />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  icon: { marginLeft: 16, justifyContent: 'center' },
  amount: { alignSelf: 'center', fontVariant: ['tabular-nums'], fontWeight: '600' },
  empty: { padding: 32, textAlign: 'center' },
});
