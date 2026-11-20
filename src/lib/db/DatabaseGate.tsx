import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { translate } from '@/i18n/i18n';

import { DatabaseLockedError, openDb, resetDatabase, type Db } from './client';
import { isCorruptError } from './recoverTransactions';
import migrations from './migrations/migrations';

const LOCKED_RETRY_MS = 3000;

/** Opens the local SQLite DB and runs migrations before rendering the app. */
export function DatabaseGate({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const open = useCallback(() => {
    setError(null);
    openDb().then(setDb, setError);
  }, []);
  const reset = useCallback(() => {
    // Show the spinner (no second tap on Reset) and unmount Migrate, so it migrates the new file.
    setError(null);
    setDb(null);
    resetDatabase().then(open, setError);
  }, [open]);

  useEffect(open, [open]);

  // Another tab or window holds the database: keep trying, so this page opens
  // by itself once that one closes (or the previous page's worker shuts down).
  useEffect(() => {
    if (!(error instanceof DatabaseLockedError)) return;
    const timer = setTimeout(open, LOCKED_RETRY_MS);
    return () => clearTimeout(timer);
  }, [error, open]);

  if (error) return <ErrorView error={error} onRetry={open} onReset={reset} />;
  if (!db) return <Loading />;
  return (
    <Migrate db={db} onReset={reset}>
      {children}
    </Migrate>
  );
}

function Migrate({ db, onReset, children }: { db: Db; onReset: () => void; children: ReactNode }) {
  const { success, error } = useMigrations(db, migrations);

  if (error) return <ErrorView error={error} onReset={onReset} />;
  if (!success) return <Loading />;
  return children;
}

// Drizzle wraps driver errors; the useful message is in `cause`.
const describe = (error: Error) =>
  error instanceof DatabaseLockedError
    ? translate('error.lockedTab')
    : `Database error: ${error.message}${error.cause instanceof Error ? `\n${error.cause.message}` : ''}`;

function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator />
    </View>
  );
}

/** A damaged file gets a reset (retrying can't fix it); anything else gets the plain message. */
function ErrorView({ error, onRetry, onReset }: { error: Error; onRetry?: () => void; onReset: () => void }) {
  if (isCorruptError(error)) {
    return (
      <Message text={translate('error.corruptDb')} onRetry={onReset} retryLabel={translate('error.corruptDbReset')} />
    );
  }
  return <Message text={describe(error)} onRetry={onRetry} />;
}

// Paper's Text and Button follow the theme (react-native's Text is black on the dark background).
function Message({ text, onRetry, retryLabel }: { text: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <View style={styles.center}>
      <Text variant="bodyLarge" style={styles.text}>
        {text}
      </Text>
      {onRetry && (
        <Button mode="contained-tonal" onPress={onRetry}>
          {retryLabel ?? translate('common.retry')}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  text: { textAlign: 'center', maxWidth: 420 },
});
