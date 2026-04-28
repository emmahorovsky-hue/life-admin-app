// Test Database Setup
// This file runs before all tests to setup the test database

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/lifeadmin_test',
    },
  },
});

// Setup: Run once before all tests
beforeAll(async () => {
  await prisma.$connect();
  console.log('✅ Test database connected');
});

// Cleanup: Run after each test to reset data
afterEach(async () => {
  // Clear all tables in reverse order (to avoid foreign key issues)
  await prisma.subscription.deleteMany();
  await prisma.user.deleteMany();
});

// Teardown: Run once after all tests
afterAll(async () => {
  await prisma.$disconnect();
  console.log('✅ Test database disconnected');
});

export { prisma };
