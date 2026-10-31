import { parseTaka } from '@/utils/money';

import { applyKey, displayAmountText, evaluateAmount, hasOperator, type KeypadKey } from './keypad';

const type = (keys: string, start = '') =>
  [...keys].reduce((text, k) => applyKey(text, (k === '<' ? 'back' : k) as KeypadKey), start);

describe('applyKey', () => {
  it.each([
    ['250', '250'],
    ['0', '0'],
    ['05', '5'],
    ['.5', '0.5'],
    ['12.345', '12.34'],
    ['1..2', '1.2'],
    ['12<', '1'],
    ['1.5<<', '1'],
    ['<', ''],
    ['12345678901', '1234567890'],
    ['120+45', '120+45'],
    ['+5', '5'],
    ['12+-3', '12-3'],
    ['12.+3', '12+3'],
    ['1+05', '1+5'],
    ['1+.5', '1+0.5'],
    ['1.25×2.555', '1.25×2.55'],
    ['5+<', '5'],
  ])('typing %p gives %p', (keys, expected) => {
    expect(type(keys)).toBe(expected);
  });

  it('always produces text parseTaka accepts', () => {
    for (const keys of ['1.', '0.0', '999.99', '.']) expect(parseTaka(type(keys))).not.toBeNull();
  });
});

describe('displayAmountText', () => {
  it.each([
    ['', '0'],
    ['250', '250'],
    ['125000', '1,25,000'],
    ['10000000', '1,00,00,000'],
    ['1250.', '1,250.'],
    ['1250.5', '1,250.5'],
    ['125000+45×2', '1,25,000 + 45 × 2'],
    ['300-', '300 −'],
  ])('%p → %p', (text, expected) => {
    expect(displayAmountText(text)).toBe(expected);
  });
});

describe('evaluateAmount', () => {
  it.each([
    ['', null],
    ['250', 25000],
    ['120+45.5', 16550],
    ['100-30', 7000],
    ['100-130', -3000],
    ['2+3×4', 2000], // left to right, like a pocket calculator
    ['10÷3', 333],
    ['0.1+0.2', 30], // no floating-point drift
    ['99.99×3', 29997],
    ['5÷0', null],
    ['120+', 12000],
  ])('%p → %p', (text, expected) => {
    expect(evaluateAmount(text)).toBe(expected);
  });

  it('hasOperator tells a plain amount from an expression', () => {
    expect(hasOperator('1250.5')).toBe(false);
    expect(hasOperator('12-3')).toBe(true);
  });
});
