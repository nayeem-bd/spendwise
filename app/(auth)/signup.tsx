import { AuthForm } from '@/components/AuthForm';
import { useT } from '@/i18n/i18n';
import { signUp } from '@/lib/auth/auth';

export default function SignupScreen() {
  const { t } = useT();
  return (
    <AuthForm
      title={t('auth.signupTitle')}
      submitLabel={t('auth.signup')}
      onSubmit={async (email, password) => {
        const result = await signUp(email, password);
        if (result === 'confirmEmail') return t('auth.checkEmail');
      }}
      footer={{ text: t('auth.haveAccount'), linkLabel: t('auth.login'), href: '/login' }}
    />
  );
}
