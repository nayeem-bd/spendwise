// Integration tests run in plain Node (no jest-expo preset): jest-expo
// replaces global fetch with Expo's native fetch stubs, which can't reach a
// real server. Run with `npm run test:integration` (needs `npx supabase start`).
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.integration.test.ts'],
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  setupFiles: ['<rootDir>/src/test/setup.ts'],
};
