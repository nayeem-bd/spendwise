import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { translateError, useT } from '@/i18n/i18n';

type Props = {
  title: string;
  submitLabel: string;
  onSubmit: (email: string, password: string) => Promise<string | void>;
  footer: { text: string; linkLabel: string; href: '/login' | '/signup' };
};

/** Email + password form shared by login and signup. onSubmit may return an info message. */
export function AuthForm({ title, submitLabel, onSubmit, footer }: Props) {
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const message = await onSubmit(email, password);
      if (message) setInfo(message);
    } catch (e) {
      setError(translateError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.form}>
        <Text variant="headlineMedium" style={styles.title}>
          {title}
        </Text>
        <TextInput
          label={t('auth.email')}
          mode="outlined"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <TextInput
          label={t('auth.password')}
          mode="outlined"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          onSubmitEditing={submit}
        />
        {error && <HelperText type="error">{error}</HelperText>}
        {info && <HelperText type="info">{info}</HelperText>}
        <Button mode="contained" onPress={submit} loading={busy} disabled={busy || !email || !password}>
          {submitLabel}
        </Button>
        <Text style={styles.footer}>
          {footer.text}{' '}
          <Link href={footer.href} replace>
            <Text style={styles.link}>{footer.linkLabel}</Text>
          </Link>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  form: { gap: 12, padding: 24, width: '100%', maxWidth: 420, alignSelf: 'center' },
  title: { marginBottom: 8 },
  footer: { textAlign: 'center', marginTop: 8 },
  link: { fontWeight: '700', textDecorationLine: 'underline' },
});
