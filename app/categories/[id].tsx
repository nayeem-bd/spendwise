import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { IconBadge } from '@/components/IconBadge';
import { CATEGORY_ICONS, ColorPicker, COLORS, IconPicker } from '@/components/pickers';
import { useUser } from '@/lib/auth/store';
import { getDb } from '@/lib/db/client';
import { createCategory, deleteCategory, getCategory, updateCategory } from '@/lib/db/repositories/categories';
import type { CategoryType } from '@/lib/db/schema';

export default function CategoryEditScreen() {
  const { id, type: typeParam } = useLocalSearchParams<{ id: string; type?: CategoryType }>();
  const user = useUser();
  const isNew = id === 'new';
  const [existing] = useState(() => (isNew ? undefined : getCategory(getDb(), id)));

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<CategoryType>(existing?.type ?? typeParam ?? 'expense');
  const [icon, setIcon] = useState(existing?.icon ?? 'tag');
  const [color, setColor] = useState(existing?.color ?? COLORS[0]!);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isNew && (!existing || existing.deletedAt)) {
    return <Text style={styles.missing}>This category no longer exists.</Text>;
  }

  const save = () => {
    try {
      const db = getDb();
      if (isNew) createCategory(db, user.id, { name, type, icon, color });
      else updateCategory(db, id, { name, icon, color });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = () => {
    deleteCategory(getDb(), id);
    setConfirmDelete(false);
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: isNew ? 'New category' : 'Edit category' }} />
      <View style={styles.preview}>
        <IconBadge icon={icon} color={color} size={64} />
      </View>
      <TextInput label="Name" mode="outlined" value={name} onChangeText={setName} maxLength={40} />
      {isNew && (
        <SegmentedButtons
          value={type}
          onValueChange={(v) => setType(v as CategoryType)}
          buttons={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
          ]}
        />
      )}
      <Text variant="titleSmall">Icon</Text>
      <IconPicker icons={CATEGORY_ICONS} value={icon} color={color} onChange={setIcon} />
      <Text variant="titleSmall">Colour</Text>
      <ColorPicker value={color} onChange={setColor} />
      {error && <HelperText type="error">{error}</HelperText>}
      <Button mode="contained" onPress={save}>
        Save
      </Button>
      {!isNew && (
        <Button textColor="#C62828" onPress={() => setConfirmDelete(true)}>
          Delete category
        </Button>
      )}
      <ConfirmDialog
        visible={confirmDelete}
        title="Delete category?"
        message="Past transactions keep this category's name. You won't be able to pick it for new ones."
        confirmLabel="Delete"
        onConfirm={remove}
        onDismiss={() => setConfirmDelete(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  preview: { alignItems: 'center', marginVertical: 8 },
  missing: { padding: 24, textAlign: 'center' },
});
