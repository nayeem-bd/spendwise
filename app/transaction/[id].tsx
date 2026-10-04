import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button, Chip, HelperText, IconButton, SegmentedButtons, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountKeypad } from '@/components/AmountKeypad';
import { CategoryGrid } from '@/components/CategoryGrid';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ReceiptStrip } from '@/components/ReceiptStrip';
import { applyKey, displayAmountText } from '@/components/keypad';
import { useUser } from '@/lib/auth/store';
import { getDb } from '@/lib/db/client';
import { defaultRowId } from '@/lib/db/defaults';
import { getAccount, listAccounts } from '@/lib/db/repositories/accounts';
import { getCategory } from '@/lib/db/repositories/categories';
import { memberEmail, sharingSummary } from '@/lib/db/repositories/sharing';
import { addAttachment, deleteAttachment, listAttachments } from '@/lib/db/repositories/attachments';
import { budgetCrossings, budgetStatuses, type BudgetStatus } from '@/lib/db/repositories/budgets';
import { listCategories } from '@/lib/db/repositories/categories';
import { createRecurring, materializeRecurring } from '@/lib/db/repositories/recurring';
import { deleteTransaction, getTransaction, saveTransaction, type TransactionInput } from '@/lib/db/repositories/transactions';
import type { Account } from '@/lib/db/schema';
import { useLocalQuery } from '@/lib/db/useLocalQuery';
import { translate, translateError, useT, type StringKey } from '@/i18n/i18n';
import { useDisplayName } from '@/i18n/names';
import { useFormat } from '@/i18n/useFormat';
import { showNotice } from '@/store/notice';
import { moneyColors } from '@/theme';
import { addDays, monthOf, todayISO, type Frequency } from '@/utils/date';
import { localDigits } from '@/utils/digits';
import { parseTaka, poishaToInput } from '@/utils/money';
import { goBack } from '@/lib/nav';
import { page, useWindowClass } from '@/components/layout';

type TxType = 'expense' | 'income' | 'transfer';

const REPEAT_OPTIONS: { value: Frequency | 'never'; label: StringKey }[] = [
  { value: 'never', label: 'repeat.never' },
  { value: 'daily', label: 'repeat.daily' },
  { value: 'weekly', label: 'repeat.weekly' },
  { value: 'monthly', label: 'repeat.monthly' },
  { value: 'yearly', label: 'repeat.yearly' },
];

const TITLES: Record<TxType, StringKey> = { expense: 'transaction.addExpense', income: 'transaction.addIncome', transfer: 'transaction.addTransfer' };

export default function TransactionScreen() {
  const params = useLocalSearchParams<{ id: string; type?: TxType }>();
  const user = useUser();
  const theme = useTheme();
  const { t, lang } = useT();
  const f = useFormat();
  const displayName = useDisplayName();
  const { width } = useWindowClass();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardOpen();
  const twoColumns = width >= 760;
  // Phones: the amount, keypad and Save stay docked at the bottom like Monefy,
  // unless the window is too short to leave room for the details.
  const docked = !twoColumns && height >= 600;
  const segmentIcons = width >= 420; // labels get cut off next to icons on small phones
  const isNew = params.id === 'new';
  const [existing] = useState(() => (isNew ? undefined : getTransaction(getDb(), params.id)));

  const [type, setType] = useState<TxType>(existing?.type ?? params.type ?? 'expense');
  const [amountText, setAmountText] = useState(existing ? poishaToInput(existing.amount) : '');
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [accountId, setAccountId] = useState<string | null>(existing?.accountId ?? null);
  const [toAccountId, setToAccountId] = useState<string | null>(existing?.toAccountId ?? null);
  const [occurredOn, setOccurredOn] = useState(existing?.occurredOn ?? todayISO());
  const [note, setNote] = useState(existing?.note ?? '');
  const [repeat, setRepeat] = useState<Frequency | 'never'>('never');
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const categoryType = type === 'income' ? 'income' : 'expense';
  const categories = useLocalQuery((db) => listCategories(db, categoryType, user.id), ['categories'], [categoryType]);
  const accounts = useLocalQuery(listAccounts, ['accounts']);
  const savedPhotoIds = useLocalQuery(
    (db) => (isNew ? [] : listAttachments(db, params.id).map((a) => a.id)),
    ['attachments'],
    [params.id],
  );
  // Default to Cash, else the first account.
  const selectedAccountId =
    accountId ?? accounts.find((a) => a.id === defaultRowId(user.id, 'account', 'cash'))?.id ?? accounts[0]?.id ?? null;
  // Transfers default to the first other account.
  const selectedToAccountId = toAccountId ?? accounts.find((a) => a.id !== selectedAccountId)?.id ?? null;

  if (!isNew && (!existing || existing.deletedAt)) {
    return <Text style={styles.missing}>{t('transaction.missing')}</Text>;
  }

  // Added by someone who shares this account with me: view only.
  if (existing && existing.userId !== user.id) {
    const category = existing.categoryId ? getCategory(getDb(), existing.categoryId) : undefined;
    const from = existing.accountId ? getAccount(getDb(), existing.accountId) : undefined;
    const to = existing.toAccountId ? getAccount(getDb(), existing.toAccountId) : undefined;
    const rows: [string, string][] = [
      existing.type === 'transfer'
        ? [t('type.transfer'), `${displayName(from?.id, from?.name)} → ${displayName(to?.id, to?.name)}`]
        : [t('transaction.category'), displayName(category?.id, category?.name) || t('common.uncategorized')],
      ...(existing.type !== 'transfer' ? [[t('transaction.account'), displayName(from?.id, from?.name)] as [string, string]] : []),
      [t('transaction.date'), f.day(existing.occurredOn)],
      ...(existing.note ? [[t('transaction.note'), existing.note] as [string, string]] : []),
    ];
    return (
      <ScrollView contentContainerStyle={[page.narrow, styles.container]}>
        <Stack.Screen options={{ title: t('transaction.title') }} />
        <Text variant="displaySmall" style={[styles.amount, { color: existing.type === 'transfer' ? theme.colors.onSurface : moneyColors(theme.dark)[existing.type] }]}>
          {f.money(existing.amount)}
        </Text>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.readRow}>
            <Text variant="labelLarge">{label}</Text>
            <Text style={styles.readValue}>{value}</Text>
          </View>
        ))}
        <Text variant="bodyMedium">{t('transaction.addedBy', { email: memberEmail(getDb(), existing.userId) ?? '?' })}</Text>
        {savedPhotoIds.length > 0 && (
          <ReceiptStrip savedIds={savedPhotoIds} pending={[]} onAdd={() => undefined} onDeleteSaved={() => undefined} onDeletePending={() => undefined} readOnly />
        )}
        <Text variant="bodySmall">{t('transaction.readOnly')}</Text>
      </ScrollView>
    );
  }

  const changeType = (next: TxType) => {
    setType(next);
    setCategoryId(null); // categories are per type
  };

  const save = () => {
    const amount = parseTaka(amountText);
    if (amount === null || amount <= 0) {
      setError(translate('error.Enter an amount above ৳0'));
      return;
    }
    const common = { amount, accountId: selectedAccountId ?? '', note, occurredOn };
    const month = monthOf(occurredOn);
    const before = budgetStatuses(getDb(), month);
    const input: TransactionInput =
      type === 'transfer'
        ? { ...common, type, toAccountId: selectedToAccountId ?? '' }
        : { ...common, type, categoryId: categoryId ?? '' };
    try {
      if (isNew && repeat !== 'never') {
        // The rule creates this occurrence (and later ones) with its own ids.
        createRecurring(getDb(), user.id, input, repeat);
        materializeRecurring(getDb(), todayISO());
        if (occurredOn > todayISO()) showNotice(t('recurring.startsLater', { frequency: t(`repeat.${repeat}`), day: f.day(occurredOn) }));
      } else {
        const saved = saveTransaction(getDb(), user.id, input, isNew ? undefined : params.id);
        for (const photo of pendingPhotos) addAttachment(getDb(), user.id, saved.id, photo);
      }
      const crossed = budgetCrossings(before, budgetStatuses(getDb(), month));
      if (crossed.length) showNotice(crossed.map(describeBudgetAlert).join('\n'));
      goBack();
    } catch (e) {
      setError(translateError(e));
    }
  };

  const remove = () => {
    deleteTransaction(getDb(), params.id);
    setConfirmDelete(false);
    goBack();
  };

  const describeBudgetAlert = (s: BudgetStatus) => {
    const what = s.categoryId === null ? t('budget.monthly') : displayName(s.categoryId, s.name);
    return s.level === 'over'
      ? t('budget.alertOver', { name: what, spent: f.money(s.spent), amount: f.money(s.amount) })
      : t('budget.alertWarning', { name: what, percent: Math.round(s.ratio * 100) });
  };

  const color = type === 'transfer' ? theme.colors.onSurface : moneyColors(theme.dark)[type];

  const typeSwitch = (
    <SegmentedButtons
      value={type}
      onValueChange={(v) => changeType(v as TxType)}
      buttons={[
        { value: 'expense', label: t('type.expense'), icon: segmentIcons ? 'minus' : undefined },
        { value: 'income', label: t('type.income'), icon: segmentIcons ? 'plus' : undefined },
        ...(accounts.length > 1 ? [{ value: 'transfer', label: t('type.transfer'), icon: segmentIcons ? 'swap-horizontal' : undefined }] : []),
      ]}
    />
  );

  const amountDisplay = (
    <Text
      variant="displaySmall"
      style={[styles.amount, { color }]}
      numberOfLines={1}
      adjustsFontSizeToFit
      accessibilityLabel={t('transaction.amount')}
    >
      ৳{localDigits(displayAmountText(amountText), lang)}
    </Text>
  );

  const details = (
    <>
      {type === 'transfer' ? (
        <>
          <Text variant="titleSmall">{t('transaction.from')}</Text>
          <AccountChips accounts={accounts} value={selectedAccountId} onChange={setAccountId} />
          <Text variant="titleSmall">{t('transaction.to')}</Text>
          <AccountChips accounts={accounts} value={selectedToAccountId} onChange={setToAccountId} disabledId={selectedAccountId} />
        </>
      ) : (
        <>
          <Text variant="titleSmall">{t('transaction.category')}</Text>
          <CategoryGrid categories={categories} value={categoryId} onChange={setCategoryId} />
          <Text variant="titleSmall">{t('transaction.account')}</Text>
          <AccountChips accounts={accounts} value={selectedAccountId} onChange={setAccountId} />
        </>
      )}

      <View style={styles.dateRow}>
        <IconButton icon="chevron-left" accessibilityLabel={t('transaction.previousDay')} onPress={() => setOccurredOn(addDays(occurredOn, -1))} />
        <Button icon="calendar" onPress={() => setOccurredOn(todayISO())}>
          {f.day(occurredOn)}
        </Button>
        <IconButton icon="chevron-right" accessibilityLabel={t('transaction.nextDay')} onPress={() => setOccurredOn(addDays(occurredOn, 1))} />
      </View>

      <TextInput label={t('transaction.note')} mode="outlined" value={note} onChangeText={setNote} maxLength={200} />

      {!(isNew && repeat !== 'never') && (
        <ReceiptStrip
          savedIds={savedPhotoIds}
          pending={pendingPhotos}
          onAdd={(photo) => {
            if (isNew) return setPendingPhotos((list) => [...list, photo]);
            try {
              addAttachment(getDb(), user.id, params.id, photo);
            } catch (e) {
              showNotice(translateError(e));
            }
          }}
          onDeleteSaved={(id) => deleteAttachment(getDb(), id)}
          onDeletePending={(index) => setPendingPhotos((list) => list.filter((_, i) => i !== index))}
        />
      )}

      {isNew ? (
        <>
          <Text variant="titleSmall">{t('transaction.repeat')}</Text>
          <View style={styles.chips}>
            {REPEAT_OPTIONS.map((o) => (
              <Chip key={o.value} selected={repeat === o.value} showSelectedOverlay onPress={() => setRepeat(o.value)}>
                {t(o.label)}
              </Chip>
            ))}
          </View>
        </>
      ) : (
        existing?.recurringId && (
          <Button icon="repeat" onPress={() => router.push({ pathname: '/recurring/[id]', params: { id: existing.recurringId! } })}>
            {t('transaction.partOfRecurring')}
          </Button>
        )
      )}
    </>
  );

  const keypad = <AmountKeypad onKey={(key) => setAmountText((text) => applyKey(text, key))} onSubmit={save} dense={docked} />;

  const saveButton = (
    <>
      {error && <HelperText type="error">{error}</HelperText>}
      <Button mode="contained" onPress={save} contentStyle={styles.saveContent}>
        {t('common.save')}
      </Button>
    </>
  );

  const deleteButton = !isNew && (
    <Button textColor={theme.colors.error} onPress={() => setConfirmDelete(true)}>
      {t('transaction.delete')}
    </Button>
  );

  const confirmDialog = (
    <ConfirmDialog
      visible={confirmDelete}
      title={t('transaction.deleteTitle')}
      message={t('transaction.deleteMessage')}
      confirmLabel={t('common.delete')}
      onConfirm={remove}
      onDismiss={() => setConfirmDelete(false)}
    />
  );

  const title = <Stack.Screen options={{ title: isNew ? t(TITLES[type]) : t('transaction.edit') }} />;

  if (docked) {
    return (
      <View style={styles.screen}>
        {title}
        <ScrollView contentContainerStyle={[page.narrow, styles.container]} keyboardShouldPersistTaps="handled">
          {typeSwitch}
          {details}
          {deleteButton}
        </ScrollView>
        <Surface elevation={2} style={[styles.dock, { paddingBottom: 12 + insets.bottom }]}>
          <View style={[page.narrow, styles.dockContent]}>
            {amountDisplay}
            {/* The note's on-screen keyboard needs the room. */}
            {!keyboardOpen && keypad}
            {saveButton}
          </View>
        </Surface>
        {confirmDialog}
      </View>
    );
  }

  const entry = (
    <>
      {keypad}
      {saveButton}
      {deleteButton}
    </>
  );

  return (
    <ScrollView contentContainerStyle={twoColumns ? [page.wide, styles.wide] : [page.narrow, styles.container]} keyboardShouldPersistTaps="handled">
      {title}
      {twoColumns ? (
        // Amount and keypad on the left, the details on the right.
        <View style={styles.columns}>
          <View style={[styles.column, styles.entryColumn]}>
            {typeSwitch}
            {amountDisplay}
            {entry}
          </View>
          <View style={styles.column}>{details}</View>
        </View>
      ) : (
        <>
          {typeSwitch}
          {amountDisplay}
          {details}
          {entry}
        </>
      )}
      {confirmDialog}
    </ScrollView>
  );
}

/** Whether the on-screen keyboard is showing (native only; on web it overlays the page). */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

function AccountChips({
  accounts,
  value,
  onChange,
  disabledId,
}: {
  accounts: Account[];
  value: string | null;
  onChange: (id: string) => void;
  disabledId?: string | null;
}) {
  const name = useDisplayName();
  const user = useUser();
  // Two "Cash" accounts (mine and one shared with me) must be told apart.
  const shared = useLocalQuery(sharingSummary, ['account_members']);
  return (
    <View style={styles.chips}>
      {accounts.map((a) => {
        const owner = a.userId !== user.id ? shared.get(a.id)?.ownerEmail.split('@')[0] : undefined;
        return (
          <Chip
            key={a.id}
            selected={a.id === value}
            showSelectedOverlay
            icon={shared.has(a.id) ? 'account-multiple' : undefined}
            disabled={a.id === disabledId}
            onPress={() => onChange(a.id)}
          >
            {owner ? `${name(a.id, a.name)} · ${owner}` : name(a.id, a.name)}
          </Chip>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: 16, gap: 12 },
  dock: { paddingHorizontal: 16, paddingTop: 4 },
  dockContent: { gap: 8 },
  wide: { padding: 24 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 32 },
  column: { flex: 1, minWidth: 0, gap: 12 },
  entryColumn: { maxWidth: 420 },
  amount: { textAlign: 'center', fontVariant: ['tabular-nums'], marginVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  saveContent: { height: 48 },
  missing: { padding: 24, textAlign: 'center' },
  readRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  readValue: { flexShrink: 1, textAlign: 'right' },
});
