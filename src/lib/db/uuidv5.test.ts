import { uuidv5 } from './uuidv5';

// Expected values from Postgres: extensions.uuid_generate_v5(namespace, name)
const USER = '11111111-1111-1111-1111-111111111111';

describe('uuidv5', () => {
  it.each([
    [USER, 'account:cash', '747e19df-c149-52dc-87f1-ae6ba42927b7'],
    [USER, 'category:food', '0ab76198-325b-57d5-a259-3a41283ac4da'],
    [USER, 'category:other_income', '7345d52d-a0b5-5062-b941-f5fdb439d2d9'],
    ['6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'category:food', '6f1fab8c-1077-541b-b4ee-7d7a5e8d2f17'],
  ])('matches Postgres for (%s, %s)', (namespace, name, expected) => {
    expect(uuidv5(name, namespace)).toBe(expected);
  });

  it('handles names longer than one SHA-1 block', () => {
    expect(uuidv5('x'.repeat(200), USER)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
