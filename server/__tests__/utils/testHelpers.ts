// Test Helper Functions
// Reusable utilities for testing

import request from 'supertest';
import app from '../../src/index';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  token: string;
}

/**
 * Create a test user and return auth token
 */
export async function createAuthenticatedUser(
  email: string = 'test@example.com',
  password: string = 'TestPass123!',
  name: string = 'Test User'
): Promise<TestUser> {
  // Register user
  await request(app).post('/api/auth/register').send({
    email,
    password,
    name,
  });

  // Login and get token
  const loginRes = await request(app).post('/api/auth/login').send({
    email,
    password,
  });

  const cookies = loginRes.headers['set-cookie'];
  const token = cookies[0].split(';')[0].split('=')[1];

  return {
    id: loginRes.body.user.id,
    email: loginRes.body.user.email,
    name: loginRes.body.user.name,
    token,
  };
}

/**
 * Make authenticated request
 */
export function authenticatedRequest(token: string) {
  return {
    get: (url: string) => request(app).get(url).set('Cookie', [`token=${token}`]),
    post: (url: string) => request(app).post(url).set('Cookie', [`token=${token}`]),
    patch: (url: string) => request(app).patch(url).set('Cookie', [`token=${token}`]),
    delete: (url: string) => request(app).delete(url).set('Cookie', [`token=${token}`]),
  };
}

/**
 * Create a test subscription
 */
export async function createTestSubscription(
  token: string,
  data: {
    name?: string;
    cost?: number;
    currency?: string;
    billingCycle?: 'monthly' | 'annual' | 'weekly' | 'quarterly';
    renewalDate?: string;
    category?: string;
    notes?: string;
  } = {}
) {
  const subscriptionData = {
    name: data.name || 'Test Subscription',
    cost: data.cost || 9.99,
    currency: data.currency || 'USD',
    billingCycle: data.billingCycle || 'monthly',
    renewalDate: data.renewalDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    category: data.category || 'Other',
    notes: data.notes || 'Test notes',
  };

  const res = await request(app)
    .post('/api/subscriptions')
    .set('Cookie', [`token=${token}`])
    .send(subscriptionData);

  return res.body.subscription;
}

/**
 * Generate a future date
 */
export function futureDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

/**
 * Generate a past date
 */
export function pastDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}
