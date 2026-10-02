import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';

// Saturated in both themes so white labels stay readable.
const EXPENSE = '#C62828';
const INCOME = '#2E7D32';

/** The big − / + buttons that open Add Transaction. */
export function AddButtons() {
  const open = (type: 'expense' | 'income') => router.push({ pathname: '/transaction/[id]', params: { id: 'new', type } });
  return (
    <View style={styles.row}>
      <Button mode="contained" icon="minus" buttonColor={EXPENSE} textColor="#fff" style={styles.button} contentStyle={styles.content} onPress={() => open('expense')}>
        Expense
      </Button>
      <Button mode="contained" icon="plus" buttonColor={INCOME} textColor="#fff" style={styles.button} contentStyle={styles.content} onPress={() => open('income')}>
        Income
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, padding: 16 },
  button: { flex: 1 },
  content: { height: 56 },
});
