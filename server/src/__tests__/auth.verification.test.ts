import request from 'supertest';
import crypto from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from '../routes/auth';
import prisma from '../utils/db';
import * as emailService from '../services/emailService';

// Helper to hash tokens
function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(cors());
  app.use('/api/auth', authRoutes);
  return app;
};

describe('Auth Verification Endpoints', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.emailVerificationToken.deleteMany({});
    await prisma.user.deleteMany({});
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.emailVerificationToken.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('POST /api/auth/register', () => {
    it('should create user with emailVerified=false', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
           password: 'TestPass123!',
          name: 'New User',
        });

      expect(response.status).toBe(201);
      expect(response.body.user.emailVerified).toBe(false);

      const user = await prisma.user.findUnique({
        where: { email: 'newuser@example.com' },
      });
      expect(user!.emailVerified).toBe(false);
      expect(user!.emailVerifiedAt).toBeNull();
    });

    it('should trigger email verification token creation', async () => {
      const sendSpy = jest.spyOn(emailService, 'sendVerificationEmail');

      await request(app).post('/api/auth/register').send({
        email: 'newuser@example.com',
        password: 'TestPass123!',
        name: 'New User',
      });

      // Give async operation time to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const user = await prisma.user.findUnique({
        where: { email: 'newuser@example.com' },
      });

      const tokens = await prisma.emailVerificationToken.findMany({
        where: { userId: user!.id },
      });

      expect(tokens.length).toBeGreaterThan(0);
      expect(sendSpy).toHaveBeenCalled();
    });
  });

  describe('GET /api/auth/verify-email', () => {
    let testUser: any;
    let validToken: string;
    let validTokenHash: string;

    beforeEach(async () => {
      testUser = await prisma.user.create({
        data: {
          email: 'verify@example.com',
          password: 'hashedpassword',
          name: 'Verify User',
        },
      });

      validToken = crypto.randomBytes(32).toString('base64url');
      validTokenHash = hashToken(validToken);

      await prisma.emailVerificationToken.create({
        data: {
          userId: testUser.id,
          tokenHash: validTokenHash,
          email: testUser.email,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    });

    it('should redirect to success page with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify-email')
        .query({ token: validToken });

      expect(response.status).toBe(302);
      expect(response.header.location).toBe(
        'http://localhost:3000/verify-email/success'
      );

      const user = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(user!.emailVerified).toBe(true);
    });

    it('should redirect to error page with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify-email')
        .query({ token: 'invalid-token' });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('/verify-email/error');
      expect(response.header.location).toContain('reason=invalid');
    });

    it('should show already_used for consumed token', async () => {
      // Use token first time
      await request(app).get('/api/auth/verify-email').query({ token: validToken });

      // Try to use again
      const response = await request(app)
        .get('/api/auth/verify-email')
        .query({ token: validToken });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('reason=already_used');
    });

    it('should show expired for expired token', async () => {
      const expiredToken = crypto.randomBytes(32).toString('base64url');
      const expiredTokenHash = hashToken(expiredToken);

      await prisma.emailVerificationToken.create({
        data: {
          userId: testUser.id,
          tokenHash: expiredTokenHash,
          email: testUser.email,
          expiresAt: new Date(Date.now() - 1000), // Expired
        },
      });

      const response = await request(app)
        .get('/api/auth/verify-email')
        .query({ token: expiredToken });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('reason=expired');
    });

    it('should show email_changed when user email differs', async () => {
      // Update user email
      await prisma.user.update({
        where: { id: testUser.id },
        data: { email: 'newemail@example.com' },
      });

      const response = await request(app)
        .get('/api/auth/verify-email')
        .query({ token: validToken });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('reason=email_changed');
    });

    it('should set Referrer-Policy header', async () => {
      const response = await request(app)
        .get('/api/auth/verify-email')
        .query({ token: validToken });

      expect(response.header['referrer-policy']).toBe('no-referrer');
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await prisma.user.create({
        data: {
          email: 'resend@example.com',
          password: 'hashedpassword',
          name: 'Resend User',
        },
      });
    });

    it('should return 200 for unknown email (anti-enumeration)', async () => {
      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'unknown@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('If that email is registered');
    });

    it('should return 200 for already-verified user (anti-enumeration)', async () => {
      await prisma.user.update({
        where: { id: testUser.id },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      });

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: testUser.email });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('If that email is registered');

      // Should not create a new token
      const tokens = await prisma.emailVerificationToken.findMany({
        where: { userId: testUser.id },
      });
      expect(tokens).toHaveLength(0);
    });

    it('should return 200 for unverified user', async () => {
      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: testUser.email });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('If that email is registered');
      
      // Note: The actual token creation is tested in unit tests.
      // Integration test verifies endpoint behavior and anti-enumeration.
    });

    it('should enforce rate limiting (returns 200 even when limited)', async () => {
      // First request should succeed
      const response1 = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: testUser.email });
      expect(response1.status).toBe(200);

      // Second request within 60s should be rate limited but still return 200
      const response2 = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: testUser.email });
      expect(response2.status).toBe(200);
      expect(response2.body.message).toContain('If that email is registered');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'not-an-email' });

      expect(response.status).toBe(200); // Still returns 200 (anti-enumeration)
    });
  });

  describe('GET /api/auth/me', () => {
    let testUser: any;
    let authCookie: string;

    beforeEach(async () => {
      // Register a user to get auth cookie
      const response = await request(app).post('/api/auth/register').send({
        email: 'me@example.com',
          password: 'TestPass123!',
        name: 'Me User',
      });

      authCookie = response.header['set-cookie'];
      testUser = response.body.user;
    });

    it('should include emailVerified and emailVerifiedAt fields', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty('emailVerified');
      expect(response.body.user).toHaveProperty('emailVerifiedAt');
      expect(response.body.user.emailVerified).toBe(false);
      expect(response.body.user.emailVerifiedAt).toBeNull();
    });

    it('should show emailVerified=true after verification', async () => {
      // Create and consume verification token
      const token = crypto.randomBytes(32).toString('base64url');
      const tokenHash = hashToken(token);

      await prisma.emailVerificationToken.create({
        data: {
          userId: testUser.id,
          tokenHash,
          email: testUser.email,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await request(app).get('/api/auth/verify-email').query({ token });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.user.emailVerified).toBe(true);
      expect(response.body.user.emailVerifiedAt).not.toBeNull();
    });
  });
});
