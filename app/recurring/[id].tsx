import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FREQUENCY_LABEL } from '@/components/frequency';
import { getDb } from '@/lib/db/client';
import { deleteRecurring, FREQUENCIES, getRecurring, updateRecurring } from '@/lib/db/repositories/recurring';
import { formatDay, type Frequency } from '@/utils/date';
import { formatBDT, parseTaka, poishaToInput } from '@/utils/money';

export default function RecurringEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rule] = useState(() => getRecurring(getDb(), id));
  const [amountText, setAmountText] = useState(rule ? poishaToInput(rule.template.amount) : '');
  const [note, setNote] = useState(rule?.template.note ?? '');
  const [frequency, setFrequency] = useState<Frequency>(rule?.frequency ?? 'monthly');
  const [active, setActive] = useState(rule?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);

  if (!rule) return <Text style={styles.missing}>This repeating transaction no longer exists.</Text>;

  const what =
    rule.template.type === 'transfer'
      ? `Transfer ${rule.accountName} → ${rule.toAccountName}`
      : `${rule.categoryName ?? 'Uncategorized'} · ${rule.accountName}`;

  const save = () => {
    const amount = parseTaka(amountText);
    if (amount === null || amount <= 0) {
      setError('Enter an amount above ৳0');
      return;
    }
    try {
      updateRecurring(getDb(), id, { amount, note, frequency, active });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const stop = () => {
    deleteRecurring(getDb(), id);
    setConfirmStop(false);
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Repeating transaction' }} />
      <Text variant="titleMedium">{what}</Text>
      <Text variant="bodyMedium">
        {active ? `Next: ${formatDay(rule.nextRun)}` : 'Paused'} · currently {formatBDT(rule.template.amount)}
      </Text>
      <TextInput label="Amount (৳)" mode="outlined" value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" />
      <TextInput label="Note (optional)" mode="outlined" value={note} onChangeText={setNote} maxLength={200} />
      <SegmentedButtons
        value={frequency}
        onValueChange={(v) => setFrequency(v as Frequency)}
        buttons={FREQUENCIES.map((f) => ({ value: f, label: FREQUENCY_LABEL[f] }))}
      />
      <View style={styles.switchRow}>
        <Text variant="bodyLarge">Active</Text>
        <Switch value={active} onValueChange={setActive} />
      </View>
      <Text variant="bodySmall">Changes apply to future occurrences. Past transactions stay as they are.</Text>
      {error && <HelperText type="error">{error}</HelperText>}
      <Button mode="contained" onPress={save}>
        Save
      </Button>
      <Button textColor="#C62828" onPress={() => setConfirmStop(true)}>
        Stop repeating
      </Button>
      <ConfirmDialog
        visible={confirmStop}
        title="Stop repeating?"
        message="No more transactions will be created. The ones already created stay in your history."
        confirmLabel="Stop"
        onConfirm={stop}
        onDismiss={() => setConfirmStop(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  missing: { padding: 24, textAlign: 'center' },
});
