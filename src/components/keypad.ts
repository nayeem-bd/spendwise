import { parseTaka, type Poisha } from '@/utils/money';

export type Operator = '+' | '-' | '×' | '÷';
export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back' | Operator;

const MAX_WHOLE_DIGITS = 10; // up to ৳99,99,99,999
const OPERATORS: readonly string[] = ['+', '-', '×', '÷'];
export const isOperator = (key: string): key is Operator => OPERATORS.includes(key);

/** Applies a digit or "." to one number of the expression. */
function applyToNumber(text: string, key: KeypadKey): string {
  const [whole = '', fraction] = text.split('.');
  if (key === '.') return text.includes('.') ? text : `${whole || '0'}.`;
  if (fraction !== undefined) return fraction.length >= 2 ? text : text + key;
  if (whole === '0') return key; // no leading zeros
  if (whole.length >= MAX_WHOLE_DIGITS) return text;
  return text + key;
}

/**
 * Applies one keypad press to the amount text (taka), which may be a
 * calculator expression like "120+45.5×2". Invalid presses are ignored; a
 * second operator in a row replaces the first.
 */
export function applyKey(text: string, key: KeypadKey): string {
  if (key === 'back') return text.slice(0, -1);
  const last = text[text.length - 1] ?? '';
  if (isOperator(key)) {
    if (!text) return text;
    if (isOperator(last)) return text.slice(0, -1) + key;
    return (last === '.' ? text.slice(0, -1) : text) + key;
  }
  const start = Math.max(...OPERATORS.map((op) => text.lastIndexOf(op))) + 1;
  return text.slice(0, start) + applyToNumber(text.slice(start), key);
}

export const hasOperator = (text: string) => [...text].some(isOperator);

/**
 * Evaluates the amount text left to right, like a pocket calculator (Monefy
 * works the same way). Numbers are poisha integers; × and ÷ round to the
 * nearest poisha. A trailing operator is ignored. Null when there is nothing
 * to evaluate, on ÷0, or if the result is not a safe integer.
 */
export function evaluateAmount(text: string): Poisha | null {
  const tokens = text.split(/([+\-×÷])/).filter((t) => t !== '');
  if (isOperator(tokens[tokens.length - 1] ?? '')) tokens.pop();
  const first = parseTaka(tokens[0] ?? '');
  if (first === null) return null;
  let result: number = first;
  for (let i = 1; i < tokens.length; i += 2) {
    const n = parseTaka(tokens[i + 1] ?? '');
    if (n === null) return null;
    switch (tokens[i] as Operator) {
      case '+':
        result += n;
        break;
      case '-':
        result -= n;
        break;
      case '×':
        result = Math.round((result * n) / 100);
        break;
      case '÷':
        if (n === 0) return null;
        result = Math.round((result * 100) / n);
        break;
    }
  }
  return Number.isSafeInteger(result) ? (result as Poisha) : null;
}

const groupNumber = (text: string) => {
  const [whole = '0', fraction] = text.split('.');
  const grouped =
    whole.length <= 3 ? whole : `${whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${whole.slice(-3)}`;
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
};

/** Amount text for display: "125000.5" → "1,25,000.5", "120+45" → "120 + 45" (keeps a trailing "." while typing). */
export function displayAmountText(text: string): string {
  if (!text) return '0';
  return text
    .split(/([+\-×÷])/)
    .map((t) => (t === '-' ? ' − ' : isOperator(t) ? ` ${t} ` : t && groupNumber(t)))
    .join('')
    .trim();
}
