import { useCallback } from 'react';
import { create } from 'zustand';

import { localDigits, type Lang } from '@/utils/digits';

import { bn } from './bn';
import { en, type StringKey } from './en';

export type { Lang, StringKey };

const dictionaries: Record<Lang, Record<StringKey, string>> = { en, bn };

/** Device language for the first launch: Bangla if the phone/browser is set to it. */
function deviceLanguage(): Lang {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('bn') ? 'bn' : 'en';
  } catch {
    return 'en';
  }
}

export const useLanguageStore = create<{ lang: Lang }>(() => ({ lang: deviceLanguage() }));

/**
 * Translates a key, filling {placeholders}. Numbers in params are shown with
 * Bangla digits in Bangla. Usable outside React (notifications, alerts).
 */
export function translate(key: StringKey, params?: Record<string, string | number>, lang = useLanguageStore.getState().lang): string {
  let text = dictionaries[lang][key];
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, typeof value === 'number' ? localDigits(String(value), lang) : value);
    }
  }
  return text;
}

/** Translates an error from the data layer: its English message is looked up as `error.<message>`. */
export function translateError(error: unknown, lang = useLanguageStore.getState().lang): string {
  const message = error instanceof Error ? error.message : String(error);
  const key = `error.${message}` as StringKey;
  return key in dictionaries[lang] ? dictionaries[lang][key] : message;
}

/** Hook: re-renders on language change. */
export function useT() {
  const lang = useLanguageStore((s) => s.lang);
  const t = useCallback((key: StringKey, params?: Record<string, string | number>) => translate(key, params, lang), [lang]);
  return { t, lang };
}
