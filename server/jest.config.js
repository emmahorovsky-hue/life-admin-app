const path = require('path');

// Pin the timezone so date-sensitive tests are deterministic across machines/CI.
process.env.TZ = 'UTC';

// Load test environment variables before jest starts
process.env.NODE_ENV = 'test';
require('dotenv').config({ path: path.join(__dirname, '.env.test') });

// Capture the caller's DATABASE_URL (CI sets it; local shells usually don't)
// before anything else runs — importing @prisma/client auto-loads server/.env,
// which would otherwise leak the DEV database URL into globalSetup and make it
// derive the per-run test DB from the dev database. globalSetup reads this
// instead of DATABASE_URL for exactly that reason.
process.env.JEST_BASE_DATABASE_URL = process.env.DATABASE_URL || '';

module.exports = {
  preset: 'ts-jest',
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
