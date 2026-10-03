import { useCallback } from 'react';

import { useAuthStore } from '@/lib/auth/store';
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, defaultRowId } from '@/lib/db/defaults';

import { useT } from './i18n';

// Default categories/accounts are user data with English names (seeded by the
// server). In Bangla, show a translation as long as the user hasn't renamed them.

const BN_CATEGORY: Record<string, string> = {
  food: 'খাবার ও বাজার',
  transport: 'যাতায়াত',
  house_rent: 'বাসা ভাড়া',
  utility_bills: 'ইউটিলিটি বিল',
  mobile_recharge: 'মোবাইল রিচার্জ',
  shopping: 'কেনাকাটা',
  health: 'স্বাস্থ্য',
  education: 'শিক্ষা',
  family_support: 'পরিবারের খরচ',
  entertainment: 'বিনোদন',
  other_expense: 'অন্যান্য',
  salary: 'বেতন',
  business: 'ব্যবসা',
  freelance: 'ফ্রিল্যান্স',
  gift: 'উপহার',
  other_income: 'অন্যান্য',
};

const BN_ACCOUNT: Record<string, string> = { cash: 'নগদ', bkash: 'বিকাশ', bank: 'ব্যাংক' };

function translations(userId: string): Map<string, { en: string; bn: string }> {
  const map = new Map<string, { en: string; bn: string }>();
  for (const c of DEFAULT_CATEGORIES) map.set(defaultRowId(userId, 'category', c.key), { en: c.name, bn: BN_CATEGORY[c.key] ?? c.name });
  for (const a of DEFAULT_ACCOUNTS) map.set(defaultRowId(userId, 'account', a.key), { en: a.name, bn: BN_ACCOUNT[a.key] ?? a.name });
  return map;
}

let cache: { userId: string; map: ReturnType<typeof translations> } | null = null;

/** (id, stored name) → name to show. Unchanged default names are translated in Bangla. */
export function useDisplayName() {
  const { lang } = useT();
  const userId = useAuthStore((s) => s.user?.id);
  return useCallback(
    (id: string | null | undefined, name: string | null | undefined): string => {
      if (!name) return '';
      if (lang !== 'bn' || !id || !userId) return name;
      if (cache?.userId !== userId) cache = { userId, map: translations(userId) };
      const t = cache.map.get(id);
      return t && t.en === name ? t.bn : name;
    },
    [lang, userId],
  );
}
