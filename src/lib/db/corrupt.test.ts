import { isCorruptError } from './recoverTransactions';

describe('isCorruptError', () => {
  it('matches SQLite corruption errors, including ones wrapped by Drizzle', () => {
    expect(isCorruptError(new Error('Error code 11: database disk image is malformed'))).toBe(true);
    expect(isCorruptError(new Error('Error code 26: file is not a database'))).toBe(true);
    expect(
      isCorruptError(
        new Error('Failed query', {
          cause: new Error('database disk image is malformed'),
        }),
      ),
    ).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isCorruptError(new Error('Error code 5: database is locked'))).toBe(false);
    expect(isCorruptError(new Error('Error code 110: x'))).toBe(false);
    expect(isCorruptError('malformed')).toBe(false);
  });
});
