import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { AddButtons } from '@/components/AddButtons';

// The pie chart, month switcher and totals arrive in week 3.
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <Text variant="titleMedium">Spending chart coming soon</Text>
      </View>
      <AddButtons />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
