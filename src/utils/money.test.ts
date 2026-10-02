import { toPoisha } from './money';

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
