/** Integer amount in poisha (৳1 = 100 poisha). The brand stops raw numbers or taka slipping in. */
export type Poisha = number & { __brand: 'poisha' };

export const toPoisha = (taka: number): Poisha => Math.round(taka * 100) as Poisha;

export const ZERO = 0 as Poisha;

export const addPoisha = (...amounts: Poisha[]): Poisha =>
  amounts.reduce<number>((sum, a) => sum + a, 0) as Poisha;

import { toBanglaDigits } from './digits';

/** Groups an integer string South Asian style: 1,00,00,000 (last 3 digits, then pairs). */
function groupLakh(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/**
 * Formats money as BDT: ৳1,25,000, ৳250.50, -৳500.
 * The only place amounts are formatted. Grouping is done by hand rather than
 * with Intl so the output is identical on Hermes and in browsers.
 */
export function formatBDT(amount: Poisha, opts: { bangla?: boolean } = {}): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const taka = Math.floor(abs / 100);
  const poisha = abs % 100;
  let text = groupLakh(String(taka));
  if (poisha !== 0) text += `.${String(poisha).padStart(2, '0')}`;
  if (opts.bangla) text = toBanglaDigits(text);
  return `${sign}৳${text}`;
}

/** Short form for charts: ৳950, ৳12.5K, ৳1.2L, ৳3.5Cr (Bangla: ৳১.২ লাখ). */
export function formatBDTCompact(amount: Poisha, opts: { bangla?: boolean } = {}): string {
  const sign = amount < 0 ? '-' : '';
  const taka = Math.abs(amount) / 100;
  const units: [number, string, string][] = [
    [1_00_00_000, 'Cr', ' কোটি'],
    [1_00_000, 'L', ' লাখ'],
    [1_000, 'K', ' হাজার'],
  ];
  const digits = (s: string) => (opts.bangla ? toBanglaDigits(s) : s);
  for (const [size, suffix, bnSuffix] of units) {
    if (taka >= size) {
      const value = Math.floor((taka / size) * 10) / 10; // truncate so ৳99,999 never shows as ৳100K
      return `${sign}৳${digits(value.toString())}${opts.bangla ? bnSuffix : suffix}`;
    }
  }
  return `${sign}৳${digits(String(Math.floor(taka)))}`;
}

/**
 * Parses keypad/text input in taka ("1250", "1,250.5") to poisha without
 * floating-point maths. Returns null for anything that isn't a valid
 * non-negative amount with at most 2 decimals.
 */
export function parseTaka(input: string): Poisha | null {
  const cleaned = input.replace(/[,\s৳]/g, '');
  const match = /^(\d*)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match || cleaned === '' || cleaned === '.') return null;
  const whole = match[1] ? Number(match[1]) : 0;
  const fraction = (match[2] ?? '').padEnd(2, '0');
  const result = whole * 100 + Number(fraction);
  return Number.isSafeInteger(result) ? (result as Poisha) : null;
}

/** Poisha → plain taka string for editing in an input: 125050 → "1250.5". */
export function poishaToInput(amount: Poisha): string {
  const taka = Math.floor(Math.abs(amount) / 100);
  const poisha = Math.abs(amount) % 100;
  if (poisha === 0) return String(taka);
  return `${taka}.${String(poisha).padStart(2, '0').replace(/0$/, '')}`;
}
