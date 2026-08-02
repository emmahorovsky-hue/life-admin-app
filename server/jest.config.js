const path = require('path');

// Pin the timezone so date-sensitive tests are deterministic across machines/CI.
process.env.TZ = 'UTC';

// Load test environment variables before jest starts
process.env.NODE_ENV = 'test';
require('dotenv').config({ path: path.join(__dirname, '.env.test') });

// Capture the caller's DATABASE_URL (CI sets it; local shells usually don't)
// before anything else runs, and let globalSetup derive the per-run test DB
// from this rather than from a later process.env.DATABASE_URL.
//
// Prisma 7 dropped the client's automatic .env loading, so @prisma/client no
// longer leaks server/.env's DEV url into globalSetup on import — this capture
// is now belt-and-braces against anything else (a stray dotenv call, a future
// import) mutating DATABASE_URL between here and globalSetup.
process.env.JEST_BASE_DATABASE_URL = process.env.DATABASE_URL || '';

module.exports = {
  preset: 'ts-jest',
  // The build tsconfig excludes tests and (on TS 6) no longer auto-includes the
  // hoisted @types/jest, so tests compile against tsconfig.test.json instead.
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!src/index.ts',
  ],
  // globalSetup creates a database unique to this jest invocation and migrates
  // it, so concurrent runs can't clobber each other (LIF-167); globalTeardown
  // drops it again.
  globalSetup: '<rootDir>/src/__tests__/globalSetup.ts',
  globalTeardown: '<rootDir>/src/__tests__/globalTeardown.ts',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 10000,
  // Test files within one run still share that run's database and setup.ts
  // wipes all tables between tests, so files are NOT safe to run in parallel —
  // concurrent workers clobber each other's data. Run serially.
  maxWorkers: 1,
};
