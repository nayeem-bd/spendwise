import { AuthForm } from '@/components/AuthForm';
import { useT } from '@/i18n/i18n';
import { signIn } from '@/lib/auth/auth';

export default function LoginScreen() {
  const { t } = useT();
  return (
    <AuthForm
      title={t('auth.loginTitle')}
      submitLabel={t('auth.login')}
      onSubmit={signIn}
      footer={{ text: t('auth.newHere'), linkLabel: t('auth.createAccount'), href: '/signup' }}
    />
  );
}
