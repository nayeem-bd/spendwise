import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { FAB, List, SegmentedButtons } from 'react-native-paper';

import { IconBadge } from '@/components/IconBadge';
import { useT } from '@/i18n/i18n';
import { useUser } from '@/lib/auth/store';
import { useDisplayName } from '@/i18n/names';
import { listCategories } from '@/lib/db/repositories/categories';
import type { CategoryType } from '@/lib/db/schema';
import { useLocalQuery } from '@/lib/db/useLocalQuery';
import { page } from '@/components/layout';

export default function CategoriesScreen() {
  const [type, setType] = useState<CategoryType>('expense');
  const { t } = useT();
  const user = useUser();
  const name = useDisplayName();
  const items = useLocalQuery((db) => listCategories(db, type, user.id), ['categories'], [type]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('settings.categories') }} />
      <SegmentedButtons
        style={styles.segment}
        value={type}
        onValueChange={(v) => setType(v as CategoryType)}
        buttons={[
          { value: 'expense', label: t('type.expense') },
          { value: 'income', label: t('type.income') },
        ]}
      />
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <List.Item
            title={name(item.id, item.name)}
            left={() => <View style={styles.icon}><IconBadge icon={item.icon} color={item.color} /></View>}
            onPress={() => router.push({ pathname: '/categories/[id]', params: { id: item.id } })}
          />
        )}
        contentContainerStyle={[page.list, styles.list]}
      />
      <FAB
        icon="plus"
        label={t('category.new')}
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
