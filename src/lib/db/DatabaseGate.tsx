import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { translate } from '@/i18n/i18n';

import { DatabaseLockedError, openDb, type Db } from './client';
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

  useEffect(open, [open]);

  // Another tab or window holds the database: keep trying, so this page opens
  // by itself once that one closes (or the previous page's worker shuts down).
  useEffect(() => {
    if (!(error instanceof DatabaseLockedError)) return;
    const timer = setTimeout(open, LOCKED_RETRY_MS);
    return () => clearTimeout(timer);
  }, [error, open]);

  if (error) return <Message text={describe(error)} onRetry={open} />;
  if (!db) return <Loading />;
  return <Migrate db={db}>{children}</Migrate>;
}

function Migrate({ db, children }: { db: Db; children: ReactNode }) {
  const { success, error } = useMigrations(db, migrations);

  if (error) return <Message text={describe(error)} />;
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

// Paper's Text and Button follow the theme (react-native's Text is black on the dark background).
function Message({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text variant="bodyLarge" style={styles.text}>
        {text}
      </Text>
      {onRetry && (
        <Button mode="contained-tonal" onPress={onRetry}>
          {translate('common.retry')}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  text: { textAlign: 'center', maxWidth: 420 },
});
