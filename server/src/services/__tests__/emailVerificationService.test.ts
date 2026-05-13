import crypto from 'crypto';
import prisma from '../../utils/db';
import {
  issueEmailVerificationToken,
  consumeEmailVerificationToken,
} from '../emailVerificationService';
import * as emailService from '../emailService';

// Helper function to hash tokens (same as service)
function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

describe('emailVerificationService', () => {
  let testUser: any;

  beforeEach(async () => {
    // Clean up test data
    await prisma.emailVerificationToken.deleteMany({});
    await prisma.user.deleteMany({});

    // Create a test user
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password: 'hashedpassword',
        name: 'Test User',
      },
    });
  });

  afterEach(async () => {
    await prisma.emailVerificationToken.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('issueEmailVerificationToken', () => {
    it('should create a verification token with SHA-256 hash', async () => {
      await issueEmailVerificationToken(testUser.id, testUser.email);

      const tokens = await prisma.emailVerificationToken.findMany({
        where: { userId: testUser.id },
      });

      expect(tokens).toHaveLength(1);
      expect(tokens[0].tokenHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 produces 64 hex chars
      expect(tokens[0].email).toBe(testUser.email);
      expect(tokens[0].usedAt).toBeNull();
    });

    it('should set expiry to 24 hours from now', async () => {
      const before = new Date(Date.now() + 23.9 * 60 * 60 * 1000);
      await issueEmailVerificationToken(testUser.id, testUser.email);
      const after = new Date(Date.now() + 24.1 * 60 * 60 * 1000);

      const token = await prisma.emailVerificationToken.findFirst({
        where: { userId: testUser.id },
      });

      expect(token!.expiresAt.getTime()).toBeGreaterThan(before.getTime());
      expect(token!.expiresAt.getTime()).toBeLessThan(after.getTime());
    });

    it('should invalidate prior unused tokens', async () => {
      // Issue first token
      await issueEmailVerificationToken(testUser.id, testUser.email);
      const firstToken = await prisma.emailVerificationToken.findFirst({
        where: { userId: testUser.id },
      });

      // Issue second token
      await issueEmailVerificationToken(testUser.id, testUser.email);

      // First token should now be marked as used
      const updatedFirstToken = await prisma.emailVerificationToken.findUnique({
        where: { id: firstToken!.id },
      });
      expect(updatedFirstToken!.usedAt).not.toBeNull();

      // Second token should be active
      const allTokens = await prisma.emailVerificationToken.findMany({
        where: { userId: testUser.id, usedAt: null },
      });
      expect(allTokens).toHaveLength(1);
    });

    it('should call sendVerificationEmail with correct params', async () => {
      const sendSpy = jest.spyOn(emailService, 'sendVerificationEmail');

      await issueEmailVerificationToken(testUser.id, testUser.email);

      expect(sendSpy).toHaveBeenCalledWith({
        to: testUser.email,
        verifyUrl: expect.stringContaining('/api/auth/verify-email?token='),
        expiresInHours: 24,
      });
    });
  });

  describe('consumeEmailVerificationToken', () => {
    it('should return invalid for missing or short token', async () => {
      expect(await consumeEmailVerificationToken('')).toEqual({
        ok: false,
        reason: 'invalid',
      });
      expect(await consumeEmailVerificationToken('short')).toEqual({
        ok: false,
        reason: 'invalid',
      });
    });

    it('should return invalid for non-existent token', async () => {
      const fakeToken = crypto.randomBytes(32).toString('base64url');
      const result = await consumeEmailVerificationToken(fakeToken);

      expect(result).toEqual({ ok: false, reason: 'invalid' });
    });

    it('should return already_used for consumed token', async () => {
      // Create a used token
      const raw = crypto.randomBytes(32).toString('base64url');
      const tokenHash = hashToken(raw);

      await prisma.emailVerificationToken.create({
        data: {
          userId: testUser.id,
          tokenHash,
          email: testUser.email,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          usedAt: new Date(), // Already used
        },
      });

      const result = await consumeEmailVerificationToken(raw);
      expect(result).toEqual({ ok: false, reason: 'already_used' });
    });

    it('should return expired for expired token', async () => {
      const raw = crypto.randomBytes(32).toString('base64url');
      const tokenHash = hashToken(raw);

      await prisma.emailVerificationToken.create({
        data: {
          userId: testUser.id,
          tokenHash,
          email: testUser.email,
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        },
      });

      const result = await consumeEmailVerificationToken(raw);
      expect(result).toEqual({ ok: false, reason: 'expired' });
    });

    it('should return email_changed when user email differs from token email', async () => {
      const raw = crypto.randomBytes(32).toString('base64url');
      const tokenHash = hashToken(raw);

      // Create token with old email
      await prisma.emailVerificationToken.create({
        data: {
          userId: testUser.id,
          tokenHash,
          email: 'old@example.com', // Different from user's current email
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const result = await consumeEmailVerificationToken(raw);
      expect(result).toEqual({ ok: false, reason: 'email_changed' });
    });

    it('should successfully verify user with valid token', async () => {
      const raw = crypto.randomBytes(32).toString('base64url');
      const tokenHash = hashToken(raw);

      await prisma.emailVerificationToken.create({
        data: {
          userId: testUser.id,
          tokenHash,
          email: testUser.email,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const result = await consumeEmailVerificationToken(raw);

      expect(result).toEqual({ ok: true, userId: testUser.id });

      // Check user is verified
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(updatedUser!.emailVerified).toBe(true);
      expect(updatedUser!.emailVerifiedAt).not.toBeNull();
    });

    it('should mark token as used after successful verification', async () => {
      const raw = crypto.randomBytes(32).toString('base64url');
      const tokenHash = hashToken(raw);

      const token = await prisma.emailVerificationToken.create({
        data: {
          userId: testUser.id,
          tokenHash,
          email: testUser.email,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await consumeEmailVerificationToken(raw);

      const updatedToken = await prisma.emailVerificationToken.findUnique({
        where: { id: token.id },
      });
      expect(updatedToken!.usedAt).not.toBeNull();
    });

    it('should invalidate other unused tokens for the same user', async () => {
      // Create multiple tokens for the same user
      const raw1 = crypto.randomBytes(32).toString('base64url');
      const tokenHash1 = hashToken(raw1);
      await prisma.emailVerificationToken.create({
        data: {
          userId: testUser.id,
          tokenHash: tokenHash1,
          email: testUser.email,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const raw2 = crypto.randomBytes(32).toString('base64url');
      const tokenHash2 = hashToken(raw2);
      await prisma.emailVerificationToken.create({
        data: {
          userId: testUser.id,
          tokenHash: tokenHash2,
          email: testUser.email,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // Consume one token
      await consumeEmailVerificationToken(raw1);

      // All tokens should now be marked as used
      const allTokens = await prisma.emailVerificationToken.findMany({
        where: { userId: testUser.id },
      });
      allTokens.forEach((token) => {
        expect(token.usedAt).not.toBeNull();
      });
    });
  });
});
