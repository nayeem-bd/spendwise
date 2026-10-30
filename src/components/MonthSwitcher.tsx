import { StyleSheet, View } from 'react-native';
import { Button, IconButton, useTheme } from 'react-native-paper';

import { useT } from '@/i18n/i18n';
import { useFormat } from '@/i18n/useFormat';
import { useMonthStore } from '@/store/month';
import { monthOf, todayISO } from '@/utils/date';

/** ‹ Oct 2026 › in a pill. Tapping the month jumps back to the current one. */
export function MonthSwitcher({ onCard = false }: { onCard?: boolean }) {
  const { month, shift, reset } = useMonthStore();
  const { t } = useT();
  const f = useFormat();
  const isCurrent = month === monthOf(todayISO());
  const theme = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: onCard ? theme.colors.elevation.level2 : theme.colors.elevation.level1 }]}>
      <IconButton icon="chevron-left" size={20} accessibilityLabel={t('month.previous')} onPress={() => shift(-1)} />
      <Button
        onPress={isCurrent ? undefined : reset}
        // Not `disabled`: that greys out the label. Tapping the current month does nothing.
        textColor={isCurrent ? theme.colors.onSurface : theme.colors.primary}
        labelStyle={styles.label}
        accessibilityHint={isCurrent ? undefined : t('month.goToCurrent')}
      >
        {f.month(month)}
      </Button>
      <IconButton icon="chevron-right" size={20} accessibilityLabel={t('month.next')} onPress={() => shift(1)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', borderRadius: 999, marginVertical: 8 },
  label: { fontSize: 17, fontWeight: '600', minWidth: 96 },
});
