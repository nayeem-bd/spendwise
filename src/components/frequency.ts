import type { StringKey } from '@/i18n/i18n';
import type { Frequency } from '@/utils/date';

export const FREQUENCY_KEY: Record<Frequency, StringKey> = {
  daily: 'repeat.daily',
  weekly: 'repeat.weekly',
  monthly: 'repeat.monthly',
  yearly: 'repeat.yearly',
};
