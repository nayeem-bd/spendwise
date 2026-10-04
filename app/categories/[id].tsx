import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { IconBadge } from '@/components/IconBadge';
import { CATEGORY_ICONS, ColorPicker, COLORS, IconPicker } from '@/components/pickers';
import { translateError, useT } from '@/i18n/i18n';
import { useUser } from '@/lib/auth/store';
import { getDb } from '@/lib/db/client';
import { createCategory, deleteCategory, getCategory, updateCategory } from '@/lib/db/repositories/categories';
import type { CategoryType } from '@/lib/db/schema';
import { goBack } from '@/lib/nav';
import { page } from '@/components/layout';

export default function CategoryEditScreen() {
  const { id, type: typeParam } = useLocalSearchParams<{ id: string; type?: CategoryType }>();
  const user = useUser();
  const { t } = useT();
  const theme = useTheme();
  const isNew = id === 'new';
  const [existing] = useState(() => (isNew ? undefined : getCategory(getDb(), id)));

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<CategoryType>(existing?.type ?? typeParam ?? 'expense');
  const [icon, setIcon] = useState(existing?.icon ?? 'tag');
  const [color, setColor] = useState(existing?.color ?? COLORS[0]!);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isNew && (!existing || existing.deletedAt)) {
    return <Text style={styles.missing}>{t('category.missing')}</Text>;
  }

  const save = () => {
    try {
      const db = getDb();
      if (isNew) createCategory(db, user.id, { name, type, icon, color });
      else updateCategory(db, id, { name, icon, color });
      goBack();
    } catch (e) {
      setError(translateError(e));
    }
  };

  const remove = () => {
    deleteCategory(getDb(), id);
    setConfirmDelete(false);
    goBack();
  };

  return (
    <ScrollView contentContainerStyle={[page.narrow, styles.container]}>
      <Stack.Screen options={{ title: isNew ? t('category.new') : t('category.edit') }} />
      <View style={styles.preview}>
        <IconBadge icon={icon} color={color} size={64} />
      </View>
      <TextInput label={t('common.name')} mode="outlined" value={name} onChangeText={setName} maxLength={40} />
      {isNew && (
        <SegmentedButtons
          value={type}
          onValueChange={(v) => setType(v as CategoryType)}
          buttons={[
            { value: 'expense', label: t('type.expense') },
            { value: 'income', label: t('type.income') },
          ]}
        />
      )}
      <Text variant="titleSmall">{t('common.icon')}</Text>
      <IconPicker icons={CATEGORY_ICONS} value={icon} color={color} onChange={setIcon} />
      <Text variant="titleSmall">{t('common.colour')}</Text>
      <ColorPicker value={color} onChange={setColor} />
      {error && <HelperText type="error">{error}</HelperText>}
      <Button mode="contained" onPress={save}>
        {t('common.save')}
      </Button>
      {!isNew && (
        <Button textColor={theme.colors.error} onPress={() => setConfirmDelete(true)}>
          {t('category.delete')}
        </Button>
      )}
      <ConfirmDialog
        visible={confirmDelete}
        title={t('category.deleteTitle')}
        message={t('category.deleteMessage')}
        confirmLabel={t('common.delete')}
        onConfirm={remove}
        onDismiss={() => setConfirmDelete(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  preview: { alignItems: 'center', marginVertical: 8 },
  missing: { padding: 24, textAlign: 'center' },
});
