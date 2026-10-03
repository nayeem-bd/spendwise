import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { List, Text, useTheme } from 'react-native-paper';

import { useT } from '@/i18n/i18n';
import { useDisplayName } from '@/i18n/names';
import { useFormat } from '@/i18n/useFormat';
import type { TransactionListItem } from '@/lib/db/repositories/transactions';
import { moneyColors } from '@/theme';

import { IconBadge } from './IconBadge';

/** One transaction in a list. `showDate` for flat lists that aren't grouped by day. */
export function TransactionRow({ item, showDate = false }: { item: TransactionListItem; showDate?: boolean }) {
  const theme = useTheme();
  const { t } = useT();
  const f = useFormat();
  const name = useDisplayName();
  const colors = moneyColors(theme.dark);
  const transfer = item.type === 'transfer';
  const account = name(item.accountId, item.accountName) || '?';
  const toAccount = name(item.toAccountId, item.toAccountName) || '?';
  return (
    <List.Item
      title={transfer ? t('type.transfer') : name(item.categoryId, item.categoryName) || t('common.uncategorized')}
      description={
        [
          showDate ? f.day(item.occurredOn) : null,
          transfer ? `${account} → ${toAccount}` : name(item.accountId, item.accountName),
          item.recurringId ? t('recurring.label') : null,
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
          {f.money(item.amount)}
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
