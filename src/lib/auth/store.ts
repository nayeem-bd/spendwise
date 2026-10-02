import { create } from 'zustand';

export type LocalUser = { id: string; email: string };

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'signedOut'; user: null }
  | { status: 'signedIn'; user: LocalUser };

export const useAuthStore = create<AuthState>(() => ({ status: 'loading', user: null }));

/** The signed-in user. Only call from screens behind the auth guard. */
export function useUser(): LocalUser {
  const user = useAuthStore((s) => s.user);
  if (!user) throw new Error('useUser() called while signed out');
  return user;
}
