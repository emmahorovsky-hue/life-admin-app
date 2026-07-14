import os from 'os';

// Override environment variables for testing BEFORE Prisma is initialized.
// DATABASE_URL may already be set by globalSetup; only fall back if absent.
process.env.NODE_ENV = 'test';
if (!process.env.DATABASE_URL) {
  const user = os.userInfo().username;
  // Include an explicit empty password to ensure the URL contains a user.
  process.env.DATABASE_URL = `postgresql://${user}:@localhost:5432/lifeadmin_test?schema=public`;
}
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.API_URL = 'http://localhost:3001';
process.env.CLIENT_URL = 'http://localhost:3000';
// Never start the cron scheduler during tests.
process.env.ENABLE_CRON = 'false';

import prisma from '../utils/db';

// Mock every sender in the email service, not just the two the suite happened to
// exercise first. The rest were unmocked and only stayed silent because
// RESEND_API_KEY is unset in the test env — a real send was one env var away.
// Non-sender exports (buildEmailHtml) keep their real implementations.
jest.mock('../services/emailService', () => ({
  ...jest.requireActual('../services/emailService'),
  sendVerificationEmail: jest.fn().mockResolvedValue({ id: 'test-email-id' }),
  sendDeletionWarningEmail: jest.fn().mockResolvedValue({ id: 'test-email-id' }),
  sendAccountDeletedEmail: jest.fn().mockResolvedValue({ id: 'test-email-id' }),
  sendEmailChangeVerificationEmail: jest.fn().mockResolvedValue({ id: 'test-email-id' }),
  sendEmailChangedNoticeEmail: jest.fn().mockResolvedValue({ id: 'test-email-id' }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ id: 'test-email-id' }),
  sendRenewalReminderDigest: jest.fn().mockResolvedValue({ id: 'test-email-id' }),
}));
// NOTE: We do not mock `emailVerificationService.issueEmailVerificationToken`
// because several tests assert that tokens are persisted and emails are sent.

// Helper: Clean up test data
async function cleanupTestData() {
  try {
    // Delete in reverse dependency order
    await prisma.emailVerificationToken.deleteMany({});
    await prisma.notificationLog.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.deviceToken.deleteMany({});
    await prisma.user.deleteMany({});
  } catch (error) {
    console.warn('Warning during test data cleanup:', error);
    // Continue - might be first run or schema differences
  }
}

// Migrations are run once in globalSetup (jest.config.js) before the suite starts.
// Here we only need to clean up data before each test file.
beforeAll(async () => {
  await cleanupTestData();
}, 30000);

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
