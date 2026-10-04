import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, IconButton, List, Portal, Text, useTheme } from 'react-native-paper';

import { translateError, useT } from '@/i18n/i18n';
import { listMembers } from '@/lib/db/repositories/sharing';
import type { AccountMember } from '@/lib/db/schema';
import { useLocalQuery } from '@/lib/db/useLocalQuery';
import { goBack } from '@/lib/nav';
import { createInvite, leaveSharedAccount, removeMember } from '@/lib/sync/sharing';
import { showNotice } from '@/store/notice';

import { ConfirmDialog } from './ConfirmDialog';

/** Sharing for one account: owners invite and remove people; members see who shared it and can leave. */
export function SharingSection({ accountId, isOwner }: { accountId: string; isOwner: boolean }) {
  const { t } = useT();
  const theme = useTheme();
  const members = useLocalQuery((db) => listMembers(db, accountId), ['account_members'], [accountId]);
  const owner = members.find((m) => m.role === 'owner');
  const others = members.filter((m) => m.role === 'member');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'leave' } | { kind: 'remove'; member: AccountMember } | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      showNotice(translateError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="titleSmall">{t('sharing.title')}</Text>
      {!isOwner && owner && <Text>{t('sharing.sharedBy', { email: owner.email })}</Text>}
      {isOwner && others.length === 0 && <Text>{t('sharing.notShared')}</Text>}
      {others.map((m) => (
        <List.Item
          key={m.id}
          title={m.email}
          left={(props) => <List.Icon {...props} icon="account" />}
          right={() =>
            isOwner ? (
              <IconButton icon="account-remove" accessibilityLabel={t('sharing.remove')} disabled={busy} onPress={() => setConfirm({ kind: 'remove', member: m })} />
            ) : null
          }
        />
      ))}
      {isOwner ? (
        <Button icon="account-plus" mode="outlined" loading={busy} disabled={busy} onPress={() => void run(async () => setCode(await createInvite(accountId)))}>
          {t('sharing.invite')}
        </Button>
      ) : (
        <Button icon="logout" textColor={theme.colors.error} disabled={busy} onPress={() => setConfirm({ kind: 'leave' })}>
          {t('sharing.leave')}
        </Button>
      )}

      <Portal>
        <Dialog visible={code !== null} onDismiss={() => setCode(null)}>
          <Dialog.Title>{t('sharing.inviteTitle')}</Dialog.Title>
          <Dialog.Content style={styles.dialog}>
            <Text variant="headlineMedium" selectable style={styles.code}>
              {code}
            </Text>
            <Text>{t('sharing.inviteHint')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button icon="content-copy" onPress={() => code && void Clipboard.setStringAsync(code).then(() => showNotice(t('sharing.copied')))}>
              {t('sharing.copy')}
            </Button>
            <Button onPress={() => setCode(null)}>{t('sharing.done')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <ConfirmDialog
        visible={confirm !== null}
        title={confirm?.kind === 'leave' ? t('sharing.leaveTitle') : t('sharing.removeTitle')}
        message={
          confirm?.kind === 'leave'
            ? t('sharing.leaveMessage')
            : t('sharing.removeMessage', { email: confirm?.kind === 'remove' ? confirm.member.email : '' })
        }
        confirmLabel={confirm?.kind === 'leave' ? t('sharing.leave') : t('sharing.remove')}
        onDismiss={() => setConfirm(null)}
        onConfirm={() => {
          const c = confirm;
          setConfirm(null);
          if (c?.kind === 'leave') void run(async () => {
            await leaveSharedAccount(accountId);
            goBack();
          });
          if (c?.kind === 'remove') void run(() => removeMember(accountId, c.member.userId));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, marginTop: 8 },
  dialog: { gap: 12 },
  code: { letterSpacing: 4, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
