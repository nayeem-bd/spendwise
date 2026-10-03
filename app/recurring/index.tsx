import { router, Stack } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { List, Text, useTheme } from 'react-native-paper';

import { FREQUENCY_LABEL } from '@/components/frequency';
import { IconBadge } from '@/components/IconBadge';
import { listRecurring } from '@/lib/db/repositories/recurring';
import { useLocalQuery } from '@/lib/db/useLocalQuery';
import { moneyColors } from '@/theme';
import { formatDay } from '@/utils/date';
import { formatBDT } from '@/utils/money';

export default function RecurringListScreen() {
  const theme = useTheme();
  const colors = moneyColors(theme.dark);
  const rules = useLocalQuery(listRecurring, ['recurring_rules', 'categories', 'accounts']);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Repeating transactions' }} />
      <FlatList
        data={rules}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nothing repeats yet. When adding a transaction, choose Repeat → Monthly for rent, salary or subscriptions.
          </Text>
        }
        renderItem={({ item }) => {
          const t = item.template;
          const transfer = t.type === 'transfer';
          const schedule = `${FREQUENCY_LABEL[item.frequency ?? 'monthly']} · ${item.active ? `next ${formatDay(item.nextRun)}` : 'paused'}`;
          return (
            <List.Item
              title={transfer ? 'Transfer' : (item.categoryName ?? 'Uncategorized')}
              description={[schedule, transfer ? `${item.accountName} → ${item.toAccountName}` : item.accountName, t.note]
                .filter(Boolean)
                .join(' · ')}
              style={!item.active && styles.paused}
              left={() => (
                <View style={styles.icon}>
                  <IconBadge
                    icon={transfer ? 'swap-horizontal' : item.categoryIcon}
                    color={transfer ? theme.colors.outline : item.categoryColor}
                  />
                </View>
              )}
              right={() => (
                <Text
                  style={[
                    styles.amount,
                    { color: transfer ? theme.colors.onSurfaceVariant : t.type === 'income' ? colors.income : colors.expense },
                  ]}
                >
                  {formatBDT(t.amount)}
                </Text>
              )}
              onPress={() => router.push({ pathname: '/recurring/[id]', params: { id: item.id } })}
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { padding: 24, textAlign: 'center' },
  icon: { marginLeft: 16, justifyContent: 'center' },
  amount: { alignSelf: 'center', fontVariant: ['tabular-nums'], fontWeight: '600' },
  paused: { opacity: 0.55 },
});
