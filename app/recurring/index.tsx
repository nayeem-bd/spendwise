import { router, Stack } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { List, Text, useTheme } from 'react-native-paper';

import { FREQUENCY_KEY } from '@/components/frequency';
import { IconBadge } from '@/components/IconBadge';
import { useT } from '@/i18n/i18n';
import { useDisplayName } from '@/i18n/names';
import { useFormat } from '@/i18n/useFormat';
import { listRecurring } from '@/lib/db/repositories/recurring';
import { useLocalQuery } from '@/lib/db/useLocalQuery';
import { moneyColors } from '@/theme';

export default function RecurringListScreen() {
  const theme = useTheme();
  const { t } = useT();
  const f = useFormat();
  const name = useDisplayName();
  const colors = moneyColors(theme.dark);
  const rules = useLocalQuery(listRecurring, ['recurring_rules', 'categories', 'accounts']);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('recurring.title') }} />
      <FlatList
        data={rules}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('recurring.empty')}</Text>
        }
        renderItem={({ item }) => {
          const tpl = item.template;
          const transfer = tpl.type === 'transfer';
          const schedule = `${t(FREQUENCY_KEY[item.frequency ?? 'monthly'])} · ${item.active ? t('recurring.next', { day: f.day(item.nextRun) }) : t('recurring.paused')}`;
          const account = name(tpl.accountId, item.accountName);
          return (
            <List.Item
              title={transfer ? t('type.transfer') : name(tpl.categoryId, item.categoryName) || t('common.uncategorized')}
              description={[schedule, transfer ? `${account} → ${name(tpl.toAccountId, item.toAccountName)}` : account, tpl.note]
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
                    { color: transfer ? theme.colors.onSurfaceVariant : tpl.type === 'income' ? colors.income : colors.expense },
                  ]}
                >
                  {f.money(tpl.amount)}
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
