import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FREQUENCY_KEY } from '@/components/frequency';
import { translate, translateError, useT } from '@/i18n/i18n';
import { useDisplayName } from '@/i18n/names';
import { useFormat } from '@/i18n/useFormat';
import { getDb } from '@/lib/db/client';
import { deleteRecurring, FREQUENCIES, getRecurring, updateRecurring } from '@/lib/db/repositories/recurring';
import type { Frequency } from '@/utils/date';
import { parseTaka, poishaToInput } from '@/utils/money';
import { goBack } from '@/lib/nav';
import { page } from '@/components/layout';

export default function RecurringEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rule] = useState(() => getRecurring(getDb(), id));
  const { t } = useT();
  const f = useFormat();
  const name = useDisplayName();
  const [amountText, setAmountText] = useState(rule ? poishaToInput(rule.template.amount) : '');
  const [note, setNote] = useState(rule?.template.note ?? '');
  const [frequency, setFrequency] = useState<Frequency>(rule?.frequency ?? 'monthly');
  const [active, setActive] = useState(rule?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);

  if (!rule) return <Text style={styles.missing}>{t('recurring.missing')}</Text>;

  const what =
    rule.template.type === 'transfer'
      ? `${t('type.transfer')} ${name(rule.template.accountId, rule.accountName)} → ${name(rule.template.toAccountId, rule.toAccountName)}`
      : `${name(rule.template.categoryId, rule.categoryName) || t('common.uncategorized')} · ${name(rule.template.accountId, rule.accountName)}`;

  const save = () => {
    const amount = parseTaka(amountText);
    if (amount === null || amount <= 0) {
      setError(translate('error.Enter an amount above ৳0'));
      return;
    }
    try {
      updateRecurring(getDb(), id, { amount, note, frequency, active });
      goBack();
    } catch (e) {
      setError(translateError(e));
    }
  };

  const stop = () => {
    deleteRecurring(getDb(), id);
    setConfirmStop(false);
    goBack();
  };

  return (
    <ScrollView contentContainerStyle={[page.narrow, styles.container]} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: t('recurring.titleOne') }} />
      <Text variant="titleMedium">{what}</Text>
      <Text variant="bodyMedium">
        {active ? t('recurring.next', { day: f.day(rule.nextRun) }) : t('recurring.paused')} · {t('recurring.currently', { amount: f.money(rule.template.amount) })}
      </Text>
      <TextInput label={t('recurring.amount')} mode="outlined" value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" />
      <TextInput label={t('transaction.note')} mode="outlined" value={note} onChangeText={setNote} maxLength={200} />
      <SegmentedButtons
        value={frequency}
        onValueChange={(v) => setFrequency(v as Frequency)}
        buttons={FREQUENCIES.map((freq) => ({ value: freq, label: t(FREQUENCY_KEY[freq]) }))}
      />
      <View style={styles.switchRow}>
        <Text variant="bodyLarge">{t('recurring.active')}</Text>
        <Switch value={active} onValueChange={setActive} />
      </View>
      <Text variant="bodySmall">{t('recurring.changesHint')}</Text>
      {error && <HelperText type="error">{error}</HelperText>}
      <Button mode="contained" onPress={save}>
        {t('common.save')}
      </Button>
      <Button textColor="#C62828" onPress={() => setConfirmStop(true)}>
        {t('recurring.stop')}
      </Button>
      <ConfirmDialog
        visible={confirmStop}
        title={t('recurring.stopTitle')}
        message={t('recurring.stopMessage')}
        confirmLabel={t('recurring.stopConfirm')}
        onConfirm={stop}
        onDismiss={() => setConfirmStop(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  missing: { padding: 24, textAlign: 'center' },
});
