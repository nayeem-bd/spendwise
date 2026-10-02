import { addDays, addMonths, formatDay, formatMonth, monthOf, monthRange, todayISO } from './date';

describe('dates', () => {
  it('todayISO uses the local calendar', () => {
    expect(todayISO(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it.each([
    ['2026-10-03', 1, '2026-10-04'],
    ['2026-10-31', 1, '2026-11-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2028-03-01', -1, '2028-02-29'],
    ['2026-03-29', 1, '2026-03-30'],
  ])('addDays(%s, %i) = %s', (iso, n, expected) => {
    expect(addDays(iso, n)).toBe(expected);
  });

  it('formatDay', () => {
    const today = '2026-10-03';
    expect(formatDay('2026-10-03', today)).toBe('Today');
    expect(formatDay('2026-10-02', today)).toBe('Yesterday');
    expect(formatDay('2026-10-04', today)).toBe('Tomorrow');
    expect(formatDay('2026-09-26', today)).toBe('Sat, 26 Sep 2026');
  });
});

describe('months', () => {
  it.each([
    ['2026-10', 1, '2026-11'],
    ['2026-12', 1, '2027-01'],
    ['2026-01', -1, '2025-12'],
    ['2026-10', -22, '2024-12'],
  ])('addMonths(%s, %i) = %s', (m, n, expected) => {
    expect(addMonths(m, n)).toBe(expected);
  });

  it.each([
    ['2026-10', '2026-10-31'],
    ['2026-02', '2026-02-28'],
    ['2028-02', '2028-02-29'],
    ['2026-04', '2026-04-30'],
  ])('monthRange(%s) ends %s', (m, end) => {
    expect(monthRange(m)).toEqual({ start: `${m}-01`, end });
  });

  it('formats and extracts', () => {
    expect(formatMonth('2026-10')).toBe('Oct 2026');
    expect(monthOf('2026-10-03')).toBe('2026-10');
  });
});
