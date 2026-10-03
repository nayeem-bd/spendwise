import { router } from 'expo-router';

/**
 * Leaves a form after save/delete. When the screen was opened directly (a
 * shared link or a page reload on web) there's no history to go back to,
 * so go to Home instead of staying on the form.
 */
export function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
