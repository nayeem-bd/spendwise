import { safeText, toCsv } from './csv';

describe('toCsv', () => {
  it('quotes fields with commas, quotes or newlines and starts with a BOM', () => {
    expect(toCsv(['a', 'b'], [['plain', 'has, comma'], ['say "hi"', 'two\nlines']])).toBe(
      '﻿a,b\r\nplain,"has, comma"\r\n"say ""hi""","two\nlines"\r\n',
    );
  });

  it('keeps Bangla text as is', () => {
    expect(toCsv(['note'], [['বাজার']])).toBe('﻿note\r\nবাজার\r\n');
  });
});

describe('safeText', () => {
  it.each([
    ['=HYPERLINK("x")', `'=HYPERLINK("x")`],
    ['+8801700000000', `'+8801700000000`],
    ['-cmd', `'-cmd`],
    ['@SUM(A1)', `'@SUM(A1)`],
    ['tea', 'tea'],
    [null, ''],
  ])('%p → %p', (input, expected) => {
    expect(safeText(input)).toBe(expected);
  });
});
