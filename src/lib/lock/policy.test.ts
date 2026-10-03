import { LOCK_GRACE_MS, shouldLock } from './policy';

describe('shouldLock', () => {
  it('never locks when App lock is off', () => {
    expect(shouldLock(false, null, 0)).toBe(false);
    expect(shouldLock(false, 0, LOCK_GRACE_MS * 10)).toBe(false);
  });

  it('locks on a cold start', () => {
    expect(shouldLock(true, null, 123)).toBe(true);
  });

  it('allows a short trip out of the app (photo picker, share sheet)', () => {
    expect(shouldLock(true, 1000, 1000 + LOCK_GRACE_MS - 1)).toBe(false);
    expect(shouldLock(true, 1000, 1000 + LOCK_GRACE_MS)).toBe(true);
  });
});
