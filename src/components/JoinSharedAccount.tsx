import { useState, type ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Dialog, HelperText, List, Portal, TextInput } from 'react-native-paper';

import { translateError, useT } from '@/i18n/i18n';
import { joinWithCode } from '@/lib/sync/sharing';
import { showNotice } from '@/store/notice';

/** Settings row + dialog: join someone's shared account with an invite code. `left` overrides the row icon. */
export function JoinSharedAccount({ left }: { left?: ComponentProps<typeof List.Item>['left'] } = {}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      await joinWithCode(code);
      setOpen(false);
      setCode('');
      showNotice(t('sharing.joined'));
    } catch (e) {
      setError(translateError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <List.Item
        title={t('sharing.join')}
        description={t('sharing.joinHint')}
        left={left ?? ((props) => <List.Icon {...props} icon="account-multiple-plus" />)}
        onPress={() => setOpen(true)}
      />
      <Portal>
        <Dialog visible={open} onDismiss={() => setOpen(false)}>
          <Dialog.Title>{t('sharing.join')}</Dialog.Title>
          <Dialog.Content style={styles.content}>
            <TextInput
              label={t('sharing.code')}
              mode="outlined"
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              autoCorrect={false}
              onSubmitEditing={() => void join()}
            />
            {error && <HelperText type="error">{error}</HelperText>}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button onPress={() => void join()} loading={busy} disabled={busy || code.trim().length < 6}>
              {t('sharing.join')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({ content: { gap: 8 } });
