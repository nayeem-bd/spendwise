import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { IconBadge } from '@/components/IconBadge';
import { ACCOUNT_ICONS, ColorPicker, COLORS, IconPicker } from '@/components/pickers';
import { SharingSection } from '@/components/SharingSection';
import { translate, translateError, useT } from '@/i18n/i18n';
import { useDisplayName } from '@/i18n/names';
import { useUser } from '@/lib/auth/store';
import { getDb } from '@/lib/db/client';
import { createAccount, deleteAccount, getAccount, updateAccount } from '@/lib/db/repositories/accounts';
import { goBack } from '@/lib/nav';
import { parseTaka, poishaToInput, ZERO } from '@/utils/money';

export default function AccountEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const { t } = useT();
  const displayName = useDisplayName();
  const isNew = id === 'new';
  const [existing] = useState(() => (isNew ? undefined : getAccount(getDb(), id)));

  const [name, setName] = useState(existing?.name ?? '');
  const [balanceText, setBalanceText] = useState(existing ? poishaToInput(existing.initialBalance) : '');
  const [icon, setIcon] = useState(existing?.icon ?? 'wallet');
  const [color, setColor] = useState(existing?.color ?? COLORS[6]!);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isNew && (!existing || existing.deletedAt)) {
    return <Text style={styles.missing}>{t('account.missing')}</Text>;
  }

  // Someone else's account shared with me: view only, with the option to leave.
  if (existing && existing.userId !== user.id) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Stack.Screen options={{ title: t('sharing.sharedAccount') }} />
        <View style={styles.preview}>
          <IconBadge icon={existing.icon} color={existing.color} size={64} />
          <Text variant="headlineSmall">{displayName(existing.id, existing.name)}</Text>
        </View>
        <SharingSection accountId={existing.id} isOwner={false} />
      </ScrollView>
    );
  }

  const save = () => {
    const initialBalance = balanceText.trim() === '' ? ZERO : parseTaka(balanceText);
    if (initialBalance === null) {
      setError(translate('account.balanceInvalid'));
      return;
    }
    try {
      const db = getDb();
      if (isNew) createAccount(db, user.id, { name, initialBalance, icon, color });
      else updateAccount(db, id, { name, initialBalance, icon, color });
      goBack();
    } catch (e) {
      setError(translateError(e));
    }
  };

  const remove = () => {
    setConfirmDelete(false);
    try {
      deleteAccount(getDb(), id);
      goBack();
    } catch (e) {
      setError(translateError(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: isNew ? t('account.new') : t('account.edit') }} />
      <View style={styles.preview}>
        <IconBadge icon={icon} color={color} size={64} />
      </View>
      <TextInput label={t('common.name')} mode="outlined" value={name} onChangeText={setName} maxLength={40} />
      <TextInput
        label={t('account.startingBalance')}
        mode="outlined"
        value={balanceText}
        onChangeText={setBalanceText}
        keyboardType="decimal-pad"
        placeholder="0"
      />
      <Text variant="titleSmall">{t('common.icon')}</Text>
      <IconPicker icons={ACCOUNT_ICONS} value={icon} color={color} onChange={setIcon} />
      <Text variant="titleSmall">{t('common.colour')}</Text>
      <ColorPicker value={color} onChange={setColor} />
      {error && <HelperText type="error">{error}</HelperText>}
      <Button mode="contained" onPress={save}>
        {t('common.save')}
      </Button>
      {!isNew && <SharingSection accountId={id} isOwner />}
      {!isNew && (
        <Button textColor="#C62828" onPress={() => setConfirmDelete(true)}>
          {t('account.delete')}
        </Button>
      )}
      <ConfirmDialog
        visible={confirmDelete}
        title={t('account.deleteTitle')}
        message={t('account.deleteMessage')}
        confirmLabel={t('common.delete')}
        onConfirm={remove}
        onDismiss={() => setConfirmDelete(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  preview: { alignItems: 'center', marginVertical: 8, gap: 8 },
  missing: { padding: 24, textAlign: 'center' },
});
