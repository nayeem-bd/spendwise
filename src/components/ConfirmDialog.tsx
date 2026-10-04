import { Button, Dialog, Portal, Text, useTheme } from 'react-native-paper';

import { useT } from '@/i18n/i18n';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
};

export function ConfirmDialog({ visible, title, message, confirmLabel, onConfirm, onDismiss }: Props) {
  const { t } = useT();
  const theme = useTheme();
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <Text>{message}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{t('common.cancel')}</Button>
          <Button onPress={onConfirm} textColor={theme.colors.error}>
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
