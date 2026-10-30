import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { List, Text, useTheme } from 'react-native-paper';

import { useT } from '@/i18n/i18n';
import { useDisplayName } from '@/i18n/names';
import { useFormat } from '@/i18n/useFormat';
import { useAuthStore } from '@/lib/auth/store';
import { getDb } from '@/lib/db/client';
import { memberEmail } from '@/lib/db/repositories/sharing';
import { deleteTransaction, type TransactionListItem } from '@/lib/db/repositories/transactions';
import { haptic } from '@/lib/haptics';
import { moneyColors } from '@/theme';

import { ConfirmDialog } from './ConfirmDialog';
import { IconBadge, type IconName } from './IconBadge';

/**
 * One transaction in a list. `showDate` for flat lists that aren't grouped by day.
 * Swipe left on your own transactions for Edit / Delete (iOS Mail style); co-members' rows are read-only.
 */
export function TransactionRow({ item, showDate = false }: { item: TransactionListItem; showDate?: boolean }) {
  const theme = useTheme();
  const { t } = useT();
  const myId = useAuthStore((s) => s.user?.id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const open = () => router.push({ pathname: '/transaction/[id]', params: { id: item.id } });
  const row = <RowContent item={item} showDate={showDate} onPress={open} />;
  if (item.userId !== myId) return row;

  const actions = (_progress: unknown, _drag: unknown, swipe: SwipeableMethods) => (
    <View style={styles.actions}>
      <SwipeAction
        icon="pencil"
        label={t('common.edit')}
        color={SWIPE_EDIT}
        onPress={() => {
          swipe.close();
          open();
        }}
      />
      <SwipeAction
        icon="delete"
        label={t('common.delete')}
        color={SWIPE_DELETE}
        onPress={() => {
          swipe.close();
          setConfirmDelete(true);
        }}
      />
    </View>
  );

  return (
    <>
      <Swipeable
        renderRightActions={actions}
        friction={1.5}
        rightThreshold={40}
        overshootRight={false}
        onSwipeableWillOpen={() => haptic('select')}
        childrenContainerStyle={{ backgroundColor: theme.colors.elevation.level1 }}
      >
        {row}
      </Swipeable>
      {confirmDelete && (
        <ConfirmDialog
          visible
          title={t('transaction.deleteTitle')}
          message={t('transaction.deleteMessage')}
          confirmLabel={t('common.delete')}
          onConfirm={() => {
            deleteTransaction(getDb(), item.id);
            haptic('success');
            setConfirmDelete(false);
          }}
          onDismiss={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

// Saturated in both themes so white labels stay readable (like iOS swipe actions).
const SWIPE_EDIT = '#546E7A';
const SWIPE_DELETE = '#C62828';

function SwipeAction({ icon, label, color, onPress }: { icon: IconName; label: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, { backgroundColor: color, opacity: pressed ? 0.8 : 1 }]}
    >
      <MaterialCommunityIcons name={icon} size={22} color="#fff" />
      <Text variant="labelSmall" style={styles.actionLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

function RowContent({ item, showDate, onPress }: { item: TransactionListItem; showDate: boolean; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useT();
  const f = useFormat();
  const name = useDisplayName();
  const colors = moneyColors(theme.dark);
  const transfer = item.type === 'transfer';
  const myId = useAuthStore((s) => s.user?.id);
  const addedBy = myId && item.userId !== myId ? memberEmail(getDb(), item.userId) : undefined;
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
          addedBy ? t('transaction.addedBy', { email: addedBy }) : null,
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
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  icon: { marginLeft: 16, justifyContent: 'center' },
  // flexShrink 0: a long description must not squeeze the amount onto two lines.
  actions: { flexDirection: 'row' },
  action: { width: 76, alignItems: 'center', justifyContent: 'center', gap: 2 },
  actionLabel: { color: '#fff' },
  amount: { alignSelf: 'center', flexShrink: 0, fontVariant: ['tabular-nums'], fontWeight: '600' },
});
