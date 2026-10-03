import { windowClassFor } from './layout';

describe('windowClassFor', () => {
  it.each([
    [320, 'compact'],
    [599, 'compact'],
    [600, 'medium'],
    [839, 'medium'],
    [840, 'expanded'],
    [1920, 'expanded'],
  ])('%i px is %s', (width, expected) => {
    expect(windowClassFor(width)).toBe(expected);
  });
});
