import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { openDb, type Db } from './client';
import migrations from './migrations/migrations';

/** Opens the local SQLite DB and runs migrations before rendering the app. */
export function DatabaseGate({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    openDb().then(setDb, setError);
  }, []);

  if (error) return <Message text={describe(error)} />;
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
  `Database error: ${error.message}${error.cause instanceof Error ? `\n${error.cause.message}` : ''}`;

function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator />
    </View>
  );
}

function Message({ text }: { text: string }) {
  return (
    <View style={styles.center}>
      <Text>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
