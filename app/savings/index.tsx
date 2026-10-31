import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { Button, Chip, List, Text, useTheme } from 'react-native-paper';

import { EmptyState } from '@/components/EmptyState';
import { IconBadge } from '@/components/IconBadge';
import { page } from '@/components/layout';
import { CardRow, Section } from '@/components/Section';
import { TransactionRow } from '@/components/TransactionRow';
import { useT } from '@/i18n/i18n';
import { useDisplayName } from '@/i18n/names';
import { useFormat } from '@/i18n/useFormat';
import { useUser } from '@/lib/auth/store';
import { listAccountsWithBalance } from '@/lib/db/repositories/accounts';
import { groupByDay, listTransactions } from '@/lib/db/repositories/transactions';
import { useLocalQuery } from '@/lib/db/useLocalQuery';
import { addPoisha } from '@/utils/money';

/**
 * The one place savings (DPS, FDR, emergency fund) show up: balances and
 * history. Their rows are left out of income/expense everywhere else.
 */
export default function SavingsScreen() {
  const { t } = useT();
  const f = useFormat();
  const name = useDisplayName();
  const user = useUser();
  const theme = useTheme();
  const accounts = useLocalQuery((db) => listAccountsWithBalance(db, true), ['accounts', 'transactions']);
  const [filter, setFilter] = useState<string | null>(null);
  const selected = accounts.find((a) => a.id === filter)?.id ?? null; // drops a filter whose account was deleted
  const sections = useLocalQuery(
    (db) => groupByDay(listTransactions(db, { scope: 'savings', accountId: selected ?? undefined })),
    ['transactions', 'categories', 'accounts'],
    [selected],
  );
  // Your money: savings others shared with you count in their total, not yours.
  const total = addPoisha(...accounts.filter((a) => a.userId === user.id).map((a) => a.balance));
  const target = selected ?? accounts[0]?.id;
  const add = (params: Record<string, string>) => router.push({ pathname: '/transaction/[id]', params: { id: 'new', ...params } });
  const newAccount = () => router.push({ pathname: '/accounts/[id]', params: { id: 'new', savings: '1' } });

  const header = (
    <>
      <View style={styles.total}>
        <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
          {t('savings.total')}
        </Text>
        <Text variant="headlineMedium" style={styles.totalAmount}>
          {f.money(total)}
        </Text>
      </View>
      {target && (
        <View style={styles.actions}>
          <Button mode="contained-tonal" icon="arrow-down" onPress={() => add({ type: 'transfer', toAccountId: target })}>
            {t('savings.deposit')}
          </Button>
          <Button mode="contained-tonal" icon="arrow-up" onPress={() => add({ type: 'transfer', accountId: target })}>
            {t('savings.withdraw')}
          </Button>
          <Button mode="contained-tonal" icon="plus" onPress={() => add({ type: 'income', accountId: target })}>
            {t('savings.profit')}
          </Button>
        </View>
      )}
      <Section title={t('savings.accounts')} separators>
        {accounts.length === 0 && <EmptyState icon="piggy-bank-outline" text={t('savings.empty')} />}
        {accounts.map((a) => (
          <List.Item
            key={a.id}
            title={name(a.id, a.name)}
            left={() => <View style={styles.icon}><IconBadge icon={a.icon} color={a.color} /></View>}
            right={() => <Text style={styles.balance}>{f.money(a.balance)}</Text>}
            onPress={() => router.push({ pathname: '/accounts/[id]', params: { id: a.id } })}
          />
        ))}
        <List.Item title={t('savings.newAccount')} left={() => <List.Icon icon="plus" style={styles.icon} />} onPress={newAccount} />
      </Section>
      {accounts.length > 1 && (
        <View style={styles.chips}>
          <Chip selected={selected === null} showSelectedOverlay onPress={() => setFilter(null)}>
            {t('savings.all')}
          </Chip>
          {accounts.map((a) => (
            <Chip key={a.id} selected={a.id === selected} showSelectedOverlay onPress={() => setFilter(a.id)}>
              {name(a.id, a.name)}
            </Chip>
          ))}
        </View>
      )}
      {accounts.length > 0 && (
        <Text variant="labelLarge" style={[styles.historyTitle, { color: theme.colors.onSurfaceVariant }]}>
          {t('savings.history')}
        </Text>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('savings.title') }} />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={accounts.length > 0 ? <EmptyState icon="history" text={t('savings.noHistory')} /> : null}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text variant="labelLarge" style={[styles.day, { color: theme.colors.onSurfaceVariant }]}>
            {f.day(section.day)}
          </Text>
        )}
        renderItem={({ item, index, section }) => (
          <CardRow index={index} count={section.data.length}>
            <TransactionRow item={item} />
          </CardRow>
        )}
        contentContainerStyle={[page.list, styles.list]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  total: { paddingHorizontal: 28, paddingTop: 16, paddingBottom: 12, gap: 4 },
  totalAmount: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
  icon: { marginLeft: 16, justifyContent: 'center' },
  balance: { alignSelf: 'center', fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 16 },
  historyTitle: { paddingHorizontal: 28, paddingTop: 16 },
  day: { paddingHorizontal: 28, paddingTop: 12, paddingBottom: 6 },
  list: { paddingBottom: 32 },
});
