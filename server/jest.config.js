const path = require('path');

// Pin the timezone so date-sensitive tests are deterministic across machines/CI.
process.env.TZ = 'UTC';

// Load test environment variables before jest starts
process.env.NODE_ENV = 'test';
require('dotenv').config({ path: path.join(__dirname, '.env.test') });

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
  // globalSetup runs once before the entire test suite — used for DB migrations.
  globalSetup: '<rootDir>/src/__tests__/globalSetup.ts',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 10000,
  // The suite shares a single Postgres database and setup.ts wipes all tables
  // between tests, so test files are NOT safe to run in parallel — concurrent
  // workers clobber each other's data. Run serially for deterministic results.
  maxWorkers: 1,
};
