import { parseTaka } from '@/utils/money';

import { applyKey, displayAmountText, type KeypadKey } from './keypad';

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
  ])('%p → %p', (text, expected) => {
    expect(displayAmountText(text)).toBe(expected);
  });
});
