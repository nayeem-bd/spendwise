import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { List, Text, useTheme } from 'react-native-paper';

import type { TransactionListItem } from '@/lib/db/repositories/transactions';
import { moneyColors } from '@/theme';
import { formatDay } from '@/utils/date';
import { formatBDT } from '@/utils/money';

import { IconBadge } from './IconBadge';

/** One transaction in a list. `showDate` for flat lists that aren't grouped by day. */
export function TransactionRow({ item, showDate = false }: { item: TransactionListItem; showDate?: boolean }) {
  const theme = useTheme();
  const colors = moneyColors(theme.dark);
  const transfer = item.type === 'transfer';
  return (
    <List.Item
      title={transfer ? 'Transfer' : (item.categoryName ?? 'Uncategorized')}
      description={
        [
          showDate ? formatDay(item.occurredOn) : null,
          transfer ? `${item.accountName ?? '?'} → ${item.toAccountName ?? '?'}` : item.accountName,
          item.recurringId ? 'Repeating' : null,
          item.note,
        ]
          .filter(Boolean)
          .join(' · ') || undefined
      }
      left={() => (
        <View style={styles.icon}>
          {transfer ? (
            <IconBadge icon="swap-horizontal" color={theme.colors.outline} />
          ) : (
            <IconBadge icon={item.categoryIcon} color={item.categoryColor} />
          )}
        </View>
      )}
      right={() => (
        <Text
          style={[
            styles.amount,
            { color: transfer ? theme.colors.onSurfaceVariant : item.type === 'income' ? colors.income : colors.expense },
          ]}
        >
          {transfer ? '' : item.type === 'income' ? '+' : '−'}
          {formatBDT(item.amount)}
        </Text>
      )}
      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })}
    />
  );
}

const styles = StyleSheet.create({
  icon: { marginLeft: 16, justifyContent: 'center' },
  amount: { alignSelf: 'center', fontVariant: ['tabular-nums'], fontWeight: '600' },
});
