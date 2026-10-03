import { useMemo } from 'react';

import { formatDay, formatMonth, todayISO } from '@/utils/date';
import { localDigits } from '@/utils/digits';
import { formatBDT, formatBDTCompact, type Poisha } from '@/utils/money';

import { useT } from './i18n';

/** Money, dates and numbers in the current language. */
export function useFormat() {
  const { lang } = useT();
  return useMemo(() => {
    const bangla = lang === 'bn';
    return {
      money: (amount: Poisha) => formatBDT(amount, { bangla }),
      compact: (amount: Poisha) => formatBDTCompact(amount, { bangla }),
      day: (iso: string) => formatDay(iso, todayISO(), lang),
      month: (month: string) => formatMonth(month, lang),
      num: (n: number | string) => localDigits(String(n), lang),
    };
  }, [lang]);
}
