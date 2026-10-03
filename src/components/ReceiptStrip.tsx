import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, IconButton, Text, useTheme } from 'react-native-paper';

import { translateError, useT } from '@/i18n/i18n';
import { useAttachmentData } from '@/lib/attachments/useAttachmentData';
import { pickReceipt } from '@/lib/attachments/pickReceipt';
import { showNotice } from '@/store/notice';

import { ConfirmDialog } from './ConfirmDialog';

const uri = (base64: string) => `data:image/jpeg;base64,${base64}`;

type Props = {
  /** Saved photos (attachment ids) and pending ones (base64, for a transaction not saved yet). */
  savedIds: string[];
  pending: string[];
  onAdd: (base64: string) => void;
  onDeleteSaved: (id: string) => void;
  onDeletePending: (index: number) => void;
  /** View only (someone else's transaction): no adding or deleting. */
  readOnly?: boolean;
};

export function ReceiptStrip({ savedIds, pending, onAdd, onDeleteSaved, onDeletePending, readOnly = false }: Props) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<{ base64: string; remove: () => void } | null>(null);
  const [confirm, setConfirm] = useState(false);

  const add = async (source: 'camera' | 'library') => {
    setBusy(true);
    try {
      const base64 = await pickReceipt(source);
      if (base64) onAdd(base64);
    } catch (e) {
      showNotice(translateError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="titleSmall">{t('receipt.title')}</Text>
      <ScrollView horizontal contentContainerStyle={styles.row} showsHorizontalScrollIndicator={false}>
        {savedIds.map((id) => (
          <SavedThumb key={id} id={id} onOpen={(base64) => setViewing({ base64, remove: () => onDeleteSaved(id) })} />
        ))}
        {pending.map((base64, i) => (
          <Thumb key={`p${i}`} base64={base64} onPress={() => setViewing({ base64, remove: () => onDeletePending(i) })} />
        ))}
        {!readOnly && (
        <View style={styles.actions}>
          {Platform.OS !== 'web' && (
            <Button icon="camera" mode="outlined" compact disabled={busy} onPress={() => void add('camera')}>
              {t('receipt.camera')}
            </Button>
          )}
          <Button icon="image" mode="outlined" compact disabled={busy} loading={busy} onPress={() => void add('library')}>
            {t('receipt.library')}
          </Button>
        </View>
        )}
      </ScrollView>

      <Modal visible={viewing !== null} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={styles.viewer}>
          {viewing && <Image source={{ uri: uri(viewing.base64) }} style={styles.full} resizeMode="contain" accessibilityLabel={t('receipt.title')} />}
          <View style={styles.viewerBar}>
            <IconButton icon="close" iconColor="#fff" accessibilityLabel={t('common.cancel')} onPress={() => setViewing(null)} />
            {!readOnly && (
              <IconButton icon="delete" iconColor="#fff" accessibilityLabel={t('receipt.delete')} onPress={() => setConfirm(true)} />
            )}
          </View>
        </View>
        <ConfirmDialog
          visible={confirm}
          title={t('receipt.deleteTitle')}
          message={t('receipt.deleteMessage')}
          confirmLabel={t('common.delete')}
          onConfirm={() => {
            viewing?.remove();
            setConfirm(false);
            setViewing(null);
          }}
          onDismiss={() => setConfirm(false)}
        />
      </Modal>
    </View>
  );
}

function SavedThumb({ id, onOpen }: { id: string; onOpen: (base64: string) => void }) {
  const { data, failed } = useAttachmentData(id);
  const theme = useTheme();
  const { t } = useT();
  if (data) return <Thumb base64={data} onPress={() => onOpen(data)} />;
  return (
    <View style={[styles.thumb, styles.placeholder, { backgroundColor: theme.colors.surfaceVariant }]}>
      {failed ? <Text variant="labelSmall" style={styles.center}>{t('receipt.offline')}</Text> : <ActivityIndicator />}
    </View>
  );
}

function Thumb({ base64, onPress }: { base64: string; onPress: () => void }) {
  const { t } = useT();
  return (
    <Pressable onPress={onPress} accessibilityRole="imagebutton" accessibilityLabel={t('receipt.open')}>
      <Image source={{ uri: uri(base64) }} style={styles.thumb} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: { gap: 8, alignItems: 'center' },
  actions: { gap: 6 },
  thumb: { width: 72, height: 72, borderRadius: 8 },
  placeholder: { alignItems: 'center', justifyContent: 'center', padding: 4 },
  center: { textAlign: 'center' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
  full: { flex: 1, margin: 16 },
  viewerBar: { position: 'absolute', top: 40, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between' },
});
