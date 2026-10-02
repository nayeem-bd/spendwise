import { AuthForm } from '@/components/AuthForm';
import { signIn } from '@/lib/auth/auth';

export default function LoginScreen() {
  return (
    <AuthForm
      title="Log in to SpendWise"
      submitLabel="Log in"
      onSubmit={signIn}
      footer={{ text: 'New here?', linkLabel: 'Create an account', href: '/signup' }}
    />
  );
}
