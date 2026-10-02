import { AuthForm } from '@/components/AuthForm';
import { signUp } from '@/lib/auth/auth';

export default function SignupScreen() {
  return (
    <AuthForm
      title="Create your account"
      submitLabel="Sign up"
      onSubmit={async (email, password) => {
        const result = await signUp(email, password);
        if (result === 'confirmEmail') return 'Check your email to confirm your account, then log in.';
      }}
      footer={{ text: 'Already have an account?', linkLabel: 'Log in', href: '/login' }}
    />
  );
}
