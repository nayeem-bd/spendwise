export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back';

const MAX_WHOLE_DIGITS = 10; // up to ৳99,99,99,999

/** Applies one keypad press to the amount text (taka). Invalid presses are ignored. */
export function applyKey(text: string, key: KeypadKey): string {
  if (key === 'back') return text.slice(0, -1);
  const [whole = '', fraction] = text.split('.');
  if (key === '.') return text.includes('.') ? text : `${whole || '0'}.`;
  if (fraction !== undefined) return fraction.length >= 2 ? text : text + key;
  if (whole === '0') return key; // no leading zeros
  if (whole.length >= MAX_WHOLE_DIGITS) return text;
  return text + key;
}

/** Amount text for display: "125000.5" → "1,25,000.5" (keeps a trailing "." while typing). */
export function displayAmountText(text: string): string {
  if (!text) return '0';
  const [whole = '0', fraction] = text.split('.');
  const grouped =
    whole.length <= 3 ? whole : `${whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${whole.slice(-3)}`;
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}
