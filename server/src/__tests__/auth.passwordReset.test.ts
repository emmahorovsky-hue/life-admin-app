import request from 'supertest';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from '../routes/auth';
import prisma from '../utils/db';
import * as emailService from '../services/emailService';

// ts-jest compiles named exports to read-only getters, so spyOn() can't replace
// them. Mock the module instead (keeping the real impls we don't override).
jest.mock('../services/emailService', () => ({
  ...jest.requireActual('../services/emailService'),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

const sendPasswordResetEmail = emailService.sendPasswordResetEmail as jest.Mock;

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(cors());
  app.use('/api/auth', authRoutes);
  return app;
};

// Seed a reset token directly so tests control its raw value / expiry.
async function seedResetToken(
  userId: string,
  { expiresInMs = 60 * 60 * 1000, usedAt = null }: { expiresInMs?: number; usedAt?: Date | null } = {}
): Promise<string> {
  const raw = crypto.randomBytes(32).toString('base64url');
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + expiresInMs),
      usedAt,
    },
  });
  return raw;
}

describe('Auth Password Reset Endpoints', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    await prisma.passwordResetToken.deleteMany({});
    await prisma.user.deleteMany({});
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.passwordResetToken.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  async function createUser(email = 'reset@example.com', password = 'OldPass123!') {
    return prisma.user.create({
      data: { email, password: await bcrypt.hash(password, 10), name: 'Reset User' },
    });
  }

  describe('POST /api/auth/forgot-password', () => {
    it('returns generic 200 for an unknown email and creates no token (anti-enumeration)', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('If that email is registered');
      const tokens = await prisma.passwordResetToken.findMany({});
      expect(tokens).toHaveLength(0);
    });

    it('issues a token and sends an email for a known address', async () => {
      const user = await createUser();

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: user.email });

      expect(res.status).toBe(200);
      // issue happens fire-and-forget; give it a tick to flush.
      await new Promise((r) => setTimeout(r, 100));

      const tokens = await prisma.passwordResetToken.findMany({ where: { userId: user.id } });
      expect(tokens).toHaveLength(1);
      expect(tokens[0].usedAt).toBeNull();
      expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });

    it('invalidates previously-issued unused tokens when a new one is requested', async () => {
      const user = await createUser();
      await seedResetToken(user.id); // pre-existing unused token

      await request(app).post('/api/auth/forgot-password').send({ email: user.email });
      await new Promise((r) => setTimeout(r, 100));

      const tokens = await prisma.passwordResetToken.findMany({ where: { userId: user.id } });
      const unused = tokens.filter((t) => t.usedAt === null);
      expect(unused).toHaveLength(1); // only the freshly issued one remains active
    });

    it('returns 200 even for an invalid email format (anti-enumeration)', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('If that email is registered');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('resets the password with a valid token and lets the user log in with it', async () => {
      const user = await createUser();
      const raw = await seedResetToken(user.id);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: raw, password: 'BrandNew123!' });

      expect(res.status).toBe(200);

      // Old password no longer works, new one does.
      const updated = await prisma.user.findUnique({ where: { id: user.id } });
      expect(await bcrypt.compare('BrandNew123!', updated!.password)).toBe(true);
      expect(await bcrypt.compare('OldPass123!', updated!.password)).toBe(false);

      // Token is now consumed.
      const token = await prisma.passwordResetToken.findFirst({ where: { userId: user.id } });
      expect(token!.usedAt).not.toBeNull();
    });

    it('rejects an expired token', async () => {
      const user = await createUser();
      const raw = await seedResetToken(user.id, { expiresInMs: -1000 });

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: raw, password: 'BrandNew123!' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_RESET_TOKEN');
      expect(res.body.error.message).toContain('expired');
    });

    it('rejects an already-used token', async () => {
      const user = await createUser();
      const raw = await seedResetToken(user.id, { usedAt: new Date() });

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: raw, password: 'BrandNew123!' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('already been used');
    });

    it('rejects an unknown token', async () => {
      await createUser();
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: crypto.randomBytes(32).toString('base64url'), password: 'BrandNew123!' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('invalid');
    });

    it('rejects a weak password', async () => {
      const user = await createUser();
      const raw = await seedResetToken(user.id);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: raw, password: 'weak' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');

      // Password unchanged, token not consumed.
      const updated = await prisma.user.findUnique({ where: { id: user.id } });
      expect(await bcrypt.compare('OldPass123!', updated!.password)).toBe(true);
      const token = await prisma.passwordResetToken.findFirst({ where: { userId: user.id } });
      expect(token!.usedAt).toBeNull();
    });

    it('invalidates any sibling reset tokens after a successful reset', async () => {
      const user = await createUser();
      const raw = await seedResetToken(user.id);
      await seedResetToken(user.id); // a second outstanding token

      await request(app)
        .post('/api/auth/reset-password')
        .send({ token: raw, password: 'BrandNew123!' });

      const tokens = await prisma.passwordResetToken.findMany({ where: { userId: user.id } });
      expect(tokens.every((t) => t.usedAt !== null)).toBe(true);
    });

    it('lets only one of two concurrent requests with the same token succeed (no double-reset race)', async () => {
      const user = await createUser();
      const raw = await seedResetToken(user.id);

      const [a, b] = await Promise.all([
        request(app).post('/api/auth/reset-password').send({ token: raw, password: 'FirstWin123!' }),
        request(app).post('/api/auth/reset-password').send({ token: raw, password: 'SecondWin123!' }),
      ]);

      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([200, 400]); // exactly one succeeds
    });

    it('sets passwordChangedAt so pre-reset JWT tokens are later rejected by the middleware', async () => {
      const user = await createUser();
      const raw = await seedResetToken(user.id);

      await request(app)
        .post('/api/auth/reset-password')
        .send({ token: raw, password: 'BrandNew123!' });

      const updated = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updated!.passwordChangedAt).not.toBeNull();
    });
  });
});
