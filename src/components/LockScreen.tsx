import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';

import { useT } from '@/i18n/i18n';
import { unlock, useLockStore } from '@/lib/lock/lock';

/**
 * Covers the whole app while locked and asks for Face ID / fingerprint /
 * device PIN. A Modal, so it also covers screens presented as native modals.
 */
export function LockScreen() {
  const locked = useLockStore((s) => s.locked);
  const theme = useTheme();
  const { t } = useT();

  useEffect(() => {
    if (locked) void unlock(); // prompt straight away
  }, [locked]);

  return (
    <Modal visible={locked} animationType="none" presentationStyle="fullScreen" onRequestClose={() => undefined}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <MaterialCommunityIcons name="lock" size={56} color={theme.colors.primary} />
        <Text variant="headlineSmall">{t('lock.locked')}</Text>
        <Button mode="contained" icon="fingerprint" onPress={() => void unlock()}>
          {t('lock.unlock')}
        </Button>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
});
