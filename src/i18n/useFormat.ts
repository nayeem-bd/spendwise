import { useMemo } from 'react';

import { formatDay, formatMonth, todayISO } from '@/utils/date';
import { localDigits } from '@/utils/digits';
import { formatBDT, formatBDTCompact, type Poisha } from '@/utils/money';

import { usePrivacyStore } from '@/store/privacy';

import { useT } from './i18n';

const MASK = '৳••••';

/** Money, dates and numbers in the current language; amounts masked while "Hide amounts" is on. */
export function useFormat() {
  const { lang } = useT();
  const hidden = usePrivacyStore((s) => s.hidden);
  return useMemo(() => {
    const bangla = lang === 'bn';
    return {
      money: (amount: Poisha) => (hidden ? MASK : formatBDT(amount, { bangla })),
      compact: (amount: Poisha) => (hidden ? MASK : formatBDTCompact(amount, { bangla })),
      day: (iso: string) => formatDay(iso, todayISO(), lang),
      month: (month: string) => formatMonth(month, lang),
      num: (n: number | string) => localDigits(String(n), lang),
    };
  }, [lang, hidden]);
}
