import { getDb } from '@/lib/db/client';
import { getMeta, setMeta } from '@/lib/db/meta';
import type { Lang } from '@/utils/digits';

import { useLanguageStore } from './i18n';

const KEY = 'language'; // device preference (kept on sign-out)

export function loadLanguage(): void {
  const saved = getMeta(getDb(), KEY);
  if (saved === 'en' || saved === 'bn') useLanguageStore.setState({ lang: saved });
}

export function setLanguage(lang: Lang): void {
  setMeta(getDb(), KEY, lang);
  useLanguageStore.setState({ lang });
}
