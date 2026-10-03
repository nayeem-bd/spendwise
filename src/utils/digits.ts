const BANGLA_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/** Replaces 0-9 with Bangla digits (০-৯). */
export const toBanglaDigits = (s: string) => s.replace(/\d/g, (d) => BANGLA_DIGITS[Number(d)] ?? d);

export type Lang = 'en' | 'bn';

/** Digits in the given language. */
export const localDigits = (s: string, lang: Lang) => (lang === 'bn' ? toBanglaDigits(s) : s);
