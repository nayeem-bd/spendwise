import { formatBDT, formatBDTCompact, parseTaka, poishaToInput, toPoisha, type Poisha } from './money';

const p = (n: number) => n as Poisha;

describe('toPoisha', () => {
  it('converts whole and fractional taka to integer poisha', () => {
    expect(toPoisha(0)).toBe(0);
    expect(toPoisha(250)).toBe(25000);
    expect(toPoisha(250.5)).toBe(25050);
  });

  it('rounds away floating-point noise', () => {
    expect(toPoisha(0.1 + 0.2)).toBe(30);
    expect(toPoisha(1.005)).toBe(100);
  });

  it('keeps negatives', () => {
    expect(toPoisha(-500)).toBe(-50000);
  });
});

describe('formatBDT', () => {
  it.each([
    [0, '৳0'],
    [5000, '৳50'],
    [99900, '৳999'],
    [100000, '৳1,000'],
    [12500000, '৳1,25,000'],
    [1000000000, '৳1,00,00,000'],
    [25050, '৳250.50'],
    [25005, '৳250.05'],
    [-50000, '-৳500'],
    [-25050, '-৳250.50'],
    [1, '৳0.01'],
  ])('%i poisha → %s', (poisha, expected) => {
    expect(formatBDT(p(poisha))).toBe(expected);
  });

  it('only accepts Poisha (checked by tsc)', () => {
    // @ts-expect-error a raw number is not Poisha
    expect(formatBDT(250)).toBe('৳2.50');
  });

  it('uses Bangla digits when asked', () => {
    expect(formatBDT(p(12500000), { bangla: true })).toBe('৳১,২৫,০০০');
  });
});

describe('formatBDTCompact', () => {
  it.each([
    [95000, '৳950'],
    [1250000, '৳12.5K'],
    [9999900, '৳99.9K'],
    [12000000, '৳1.2L'],
    [3500000000, '৳3.5Cr'],
    [-12000000, '-৳1.2L'],
  ])('%i poisha → %s', (poisha, expected) => {
    expect(formatBDTCompact(p(poisha))).toBe(expected);
  });
});

describe('parseTaka', () => {
  it.each([
    ['250', 25000],
    ['250.5', 25050],
    ['250.50', 25050],
    ['250.05', 25005],
    ['0.1', 10],
    ['.5', 50],
    ['1,25,000', 12500000],
    ['৳ 100', 10000],
    ['12.', 1200],
  ])('%s → %i poisha', (input, expected) => {
    expect(parseTaka(input)).toBe(expected);
  });

  it.each(['', '.', 'abc', '1.234', '-5', '1.2.3'])('rejects %p', (input) => {
    expect(parseTaka(input)).toBeNull();
  });
});

describe('poishaToInput', () => {
  it.each([
    [25000, '250'],
    [25050, '250.5'],
    [25005, '250.05'],
    [0, '0'],
  ])('%i → %s', (poisha, expected) => {
    expect(poishaToInput(p(poisha))).toBe(expected);
  });

  it('round-trips with parseTaka', () => {
    for (const n of [1, 10, 99, 100, 12345, 25050]) {
      expect(parseTaka(poishaToInput(p(n)))).toBe(n);
    }
  });
});
