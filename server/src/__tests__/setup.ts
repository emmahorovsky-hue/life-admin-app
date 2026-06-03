import { execSync } from 'child_process';
import path from 'path';
import os from 'os';

// Override environment variables for testing BEFORE Prisma is initialized
process.env.NODE_ENV = 'test';
if (!process.env.DATABASE_URL) {
  const user = os.userInfo().username;
  // include an explicit empty password to ensure the URL contains a user
  process.env.DATABASE_URL = `postgresql://${user}:@localhost:5432/lifeadmin_test?schema=public`;
}
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.API_URL = 'http://localhost:3001';
process.env.CLIENT_URL = 'http://localhost:3000';

import prisma from '../utils/db';

// Mock the email service to prevent actual emails during tests
jest.mock('../services/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({ id: 'test-email-id' }),
}));
// NOTE: We do not mock `emailVerificationService.issueEmailVerificationToken`
// because several tests assert that tokens are persisted and emails are sent.

// Helper: Run Prisma migrations
async function runMigrations() {
  try {
    console.log('🔄 Running Prisma migrations for test database...');
    execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', {
      cwd: path.join(__dirname, '../..'),
      stdio: 'inherit',
      env: { ...process.env },
    });
    console.log('✅ Migrations completed successfully.');
  } catch (error) {
    console.warn('⚠️  Migration warning (tables may already exist):', (error as Error).message);
    // Continue - tables might already exist from a previous run
  }
}

// Helper: Clean up test data
async function cleanupTestData() {
  try {
    // Delete in reverse dependency order
    await prisma.emailVerificationToken.deleteMany({});
    await prisma.notificationLog.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.user.deleteMany({});
  } catch (error) {
    console.warn('Warning during test data cleanup:', error);
    // Continue - might be first run or schema differences
  }
}

// Run migrations and cleanup before all tests
beforeAll(async () => {
  await runMigrations();
  await cleanupTestData();
}, 60000); // 60 second timeout for migrations

// Cleanup test data before each test file
beforeEach(async () => {
  await cleanupTestData();
});

// Clean up database after all tests
afterAll(async () => {
  try {
    await cleanupTestData();
  } catch (error) {
    console.error('Error during final cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
});
