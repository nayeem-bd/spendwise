import { bn } from './bn';
import { en } from './en';
import { translate, translateError } from './i18n';

describe('translate', () => {
  it('fills placeholders, with Bangla digits for numbers in Bangla', () => {
    expect(translate('sync.offlinePending', { count: 12 }, 'en')).toBe('Offline · 12 changes pending');
    expect(translate('sync.offlinePending', { count: 12 }, 'bn')).toBe('অফলাইন · ১২টি পরিবর্তন বাকি');
  });

  it('leaves string params (already formatted money) alone', () => {
    expect(translate('budget.left', { amount: '৳১৫০' }, 'bn')).toBe('৳১৫০ বাকি');
  });
});

describe('translateError', () => {
  it('translates known data-layer messages and passes unknown ones through', () => {
    expect(translateError(new Error('Pick two different accounts'), 'bn')).toBe('দুটি আলাদা অ্যাকাউন্ট বেছে নিন');
    expect(translateError(new Error('Invalid login credentials'), 'en')).toBe('Wrong email or password.');
    expect(translateError(new Error('Something unexpected'), 'bn')).toBe('Something unexpected');
  });
});

describe('dictionaries', () => {
  // Brand names and file-format words may legitimately stay the same.
  const allowedSame = new Set<string>([]);

  it('every Bangla string is filled in and translated', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(bn[key].trim()).not.toBe('');
      if (!allowedSame.has(key)) expect({ key, value: bn[key] }).not.toEqual({ key, value: en[key] });
    }
  });

  it('Bangla keeps the same placeholders as English', () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect({ key, p: placeholders(bn[key]) }).toEqual({ key, p: placeholders(en[key]) });
    }
  });
});
