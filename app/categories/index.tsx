import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { FAB, List, SegmentedButtons } from 'react-native-paper';

import { IconBadge } from '@/components/IconBadge';
import { listCategories } from '@/lib/db/repositories/categories';
import type { CategoryType } from '@/lib/db/schema';
import { useLocalQuery } from '@/lib/db/useLocalQuery';

export default function CategoriesScreen() {
  const [type, setType] = useState<CategoryType>('expense');
  const items = useLocalQuery((db) => listCategories(db, type), ['categories'], [type]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Categories' }} />
      <SegmentedButtons
        style={styles.segment}
        value={type}
        onValueChange={(v) => setType(v as CategoryType)}
        buttons={[
          { value: 'expense', label: 'Expense' },
          { value: 'income', label: 'Income' },
        ]}
      />
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            left={() => <View style={styles.icon}><IconBadge icon={item.icon} color={item.color} /></View>}
            onPress={() => router.push({ pathname: '/categories/[id]', params: { id: item.id } })}
          />
        )}
        contentContainerStyle={styles.list}
      />
      <FAB
        icon="plus"
        label="New category"
        style={styles.fab}
        onPress={() => router.push({ pathname: '/categories/[id]', params: { id: 'new', type } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  segment: { margin: 16 },
  icon: { marginLeft: 16, justifyContent: 'center' },
  list: { paddingBottom: 96 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
