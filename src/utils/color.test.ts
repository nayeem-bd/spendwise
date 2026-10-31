import { iconColorOn } from './color';

describe('iconColorOn', () => {
  it.each([
    ['#C62828', '#FFFFFF'],
    ['#EF6C00', '#FFFFFF'],
    ['#43A047', '#FFFFFF'],
    ['#FDD835', '#212121'],
    ['#00ACC1', '#212121'],
    ['#9E9E9E', '#212121'],
    ['not-a-colour', '#FFFFFF'],
  ])('%s → %s', (bg, icon) => {
    expect(iconColorOn(bg)).toBe(icon);
  });
});
