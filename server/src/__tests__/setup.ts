import prisma from '../utils/db';

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';
process.env.API_URL = 'http://localhost:3001';
process.env.CLIENT_URL = 'http://localhost:3000';

// Mock the email service to prevent actual emails during tests
jest.mock('../services/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({ id: 'test-email-id' }),
}));

// Clean up database after each test suite
afterAll(async () => {
  await prisma.$disconnect();
});
