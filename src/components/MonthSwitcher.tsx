import { StyleSheet, View } from 'react-native';
import { Button, IconButton } from 'react-native-paper';

import { useMonthStore } from '@/store/month';
import { formatMonth, monthOf, todayISO } from '@/utils/date';

/** ‹ Oct 2026 ›. Tapping the month jumps back to the current one. */
export function MonthSwitcher() {
  const { month, shift, reset } = useMonthStore();
  const isCurrent = month === monthOf(todayISO());
  return (
    <View style={styles.row}>
      <IconButton icon="chevron-left" accessibilityLabel="Previous month" onPress={() => shift(-1)} />
      <Button
        onPress={reset}
        disabled={isCurrent}
        labelStyle={styles.label}
        accessibilityHint={isCurrent ? undefined : 'Go to the current month'}
      >
        {formatMonth(month)}
      </Button>
      <IconButton icon="chevron-right" accessibilityLabel="Next month" onPress={() => shift(1)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 18 },
});
