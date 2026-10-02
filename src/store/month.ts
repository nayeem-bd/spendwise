import { create } from 'zustand';

import { addMonths, monthOf, todayISO } from '@/utils/date';

/** The month shown on Home and Transactions ('YYYY-MM'), shared between tabs. */
export const useMonthStore = create<{ month: string; shift: (n: number) => void; reset: () => void }>((set) => ({
  month: monthOf(todayISO()),
  shift: (n) => set((s) => ({ month: addMonths(s.month, n) })),
  reset: () => set({ month: monthOf(todayISO()) }),
}));
