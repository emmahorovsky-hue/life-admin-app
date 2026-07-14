import request from 'supertest';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from '../routes/auth';
import prisma from '../utils/db';
import { generateToken } from '../utils/jwt';
import * as emailService from '../services/emailService';

// ts-jest compiles named exports to read-only getters, so spyOn() can't replace
// them. Mock the module instead (keeping the real impls we don't override).
jest.mock('../services/emailService', () => ({
  ...jest.requireActual('../services/emailService'),
  sendEmailChangeVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendEmailChangedNoticeEmail: jest.fn().mockResolvedValue(undefined),
}));

const sendEmailChangeVerificationEmail = emailService.sendEmailChangeVerificationEmail as jest.Mock;
const sendEmailChangedNoticeEmail = emailService.sendEmailChangedNoticeEmail as jest.Mock;

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

// Seed an email-change token directly so tests control its raw value / expiry.
async function seedEmailChangeToken(
  userId: string,
  newEmail: string,
  { expiresInMs = 60 * 60 * 1000, usedAt = null }: { expiresInMs?: number; usedAt?: Date | null } = {}
): Promise<string> {
  const raw = crypto.randomBytes(32).toString('base64url');
  await prisma.emailChangeToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      newEmail,
      expiresAt: new Date(Date.now() + expiresInMs),
      usedAt,
    },
  });
  return raw;
}

describe('Auth Profile Endpoints', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    await prisma.emailChangeToken.deleteMany({});
    await prisma.user.deleteMany({});
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.emailChangeToken.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  async function createUser(email = 'me@example.com', password = 'OldPass123!') {
    return prisma.user.create({
      data: { email, password: await bcrypt.hash(password, 10), name: 'Me', emailVerified: true },
    });
  }

  function authCookie(userId: string, email: string): string {
    return `token=${generateToken({ userId, email })}`;
  }

  describe('PATCH /api/auth/profile', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await request(app).patch('/api/auth/profile').send({ name: 'New' });
      expect(res.status).toBe(401);
    });

    it('updates name and surname for the logged-in user', async () => {
      const user = await createUser();

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', authCookie(user.id, user.email))
        .send({ name: 'Ada', surname: 'Lovelace' });

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('Ada');
      expect(res.body.user.surname).toBe('Lovelace');

      const updated = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updated!.name).toBe('Ada');
      expect(updated!.surname).toBe('Lovelace');
    });

    it('updates reminder emails toggle and timezone', async () => {
      const user = await createUser();

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', authCookie(user.id, user.email))
        .send({ reminderEmailsEnabled: false, timezone: 'Asia/Singapore' });

      expect(res.status).toBe(200);
      expect(res.body.user.reminderEmailsEnabled).toBe(false);
      expect(res.body.user.timezone).toBe('Asia/Singapore');

      const updated = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updated!.reminderEmailsEnabled).toBe(false);
      expect(updated!.timezone).toBe('Asia/Singapore');
    });

    it('leaves reminder settings untouched when only other fields are sent', async () => {
      const user = await createUser();

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', authCookie(user.id, user.email))
        .send({ name: 'Ada' });

      expect(res.status).toBe(200);
      expect(res.body.user.reminderEmailsEnabled).toBe(true);
      expect(res.body.user.timezone).toBe('UTC');
    });

    it('rejects a non-boolean reminderEmailsEnabled', async () => {
      const user = await createUser();

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', authCookie(user.id, user.email))
        .send({ reminderEmailsEnabled: 'yes' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects an invalid timezone', async () => {
      const user = await createUser();

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', authCookie(user.id, user.email))
        .send({ timezone: 'Not/AZone' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('updates theme and default currency', async () => {
      const user = await createUser();

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', authCookie(user.id, user.email))
        .send({ theme: 'dark', defaultCurrency: 'EUR' });

      expect(res.status).toBe(200);
      expect(res.body.user.theme).toBe('dark');
      expect(res.body.user.defaultCurrency).toBe('EUR');

      const updated = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updated!.theme).toBe('dark');
      expect(updated!.defaultCurrency).toBe('EUR');
    });

    it('returns preference defaults and passwordChangedAt when only other fields are sent', async () => {
      const user = await createUser();

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', authCookie(user.id, user.email))
        .send({ name: 'Ada' });

      expect(res.status).toBe(200);
      expect(res.body.user.theme).toBe('light');
      expect(res.body.user.defaultCurrency).toBe('SGD');
      expect(res.body.user.passwordChangedAt).toBeNull();
    });

    it('rejects an unknown theme', async () => {
      const user = await createUser();

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', authCookie(user.id, user.email))
        .send({ theme: 'blue' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects a currency outside the supported list', async () => {
      const user = await createUser();

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', authCookie(user.id, user.email))
        .send({ defaultCurrency: 'SEK' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('rejects when the current password is wrong', async () => {
      const user = await createUser();

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', authCookie(user.id, user.email))
        .send({ currentPassword: 'WrongPass123!', newPassword: 'BrandNew123!' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CURRENT_PASSWORD');

      const updated = await prisma.user.findUnique({ where: { id: user.id } });
      expect(await bcrypt.compare('OldPass123!', updated!.password)).toBe(true);
    });

    it('rejects when the new password equals the current one', async () => {
      const user = await createUser();

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', authCookie(user.id, user.email))
        .send({ currentPassword: 'OldPass123!', newPassword: 'OldPass123!' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PASSWORD_UNCHANGED');
    });

    it('rejects a weak new password', async () => {
      const user = await createUser();

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', authCookie(user.id, user.email))
        .send({ currentPassword: 'OldPass123!', newPassword: 'weak' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('changes the password, re-issues a cookie, and keeps the session alive', async () => {
      const user = await createUser();

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', authCookie(user.id, user.email))
        .send({ currentPassword: 'OldPass123!', newPassword: 'BrandNew123!' });

      expect(res.status).toBe(200);

      // Password actually rotated.
      const updated = await prisma.user.findUnique({ where: { id: user.id } });
      expect(await bcrypt.compare('BrandNew123!', updated!.password)).toBe(true);
      expect(updated!.passwordChangedAt).not.toBeNull();

      // A fresh cookie is set and its token is NOT rejected by the middleware
      // (iat >= passwordChangedAt/1000), i.e. the current session survives.
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const cookieHeader = (Array.isArray(setCookie) ? setCookie : [setCookie]).find((c: string) =>
        c.startsWith('token=')
      ) as string;
      expect(cookieHeader).toBeDefined();

      const meRes = await request(app).get('/api/auth/me').set('Cookie', cookieHeader.split(';')[0]);
      expect(meRes.status).toBe(200);
    });
  });

  describe('POST /api/auth/change-email', () => {
    it('issues a token and sends a confirmation to a free address', async () => {
      const user = await createUser();

      const res = await request(app)
        .post('/api/auth/change-email')
        .set('Cookie', authCookie(user.id, user.email))
        .send({ email: 'new@example.com' });

      expect(res.status).toBe(200);

      const tokens = await prisma.emailChangeToken.findMany({ where: { userId: user.id } });
      expect(tokens).toHaveLength(1);
      expect(tokens[0].newEmail).toBe('new@example.com');
      expect(sendEmailChangeVerificationEmail).toHaveBeenCalledTimes(1);
    });

    it('returns the same generic 200 for an already-registered address without issuing a token (anti-enumeration)', async () => {
      const user = await createUser();
      await createUser('taken@example.com');

      const res = await request(app)
        .post('/api/auth/change-email')
        .set('Cookie', authCookie(user.id, user.email))
        .send({ email: 'taken@example.com' });

      expect(res.status).toBe(200);
      const tokens = await prisma.emailChangeToken.findMany({ where: { userId: user.id } });
      expect(tokens).toHaveLength(0);
      expect(sendEmailChangeVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/auth/verify-email-change', () => {
    it('confirms the change, marks the email verified, and notifies the old address', async () => {
      const user = await createUser('old@example.com');
      const raw = await seedEmailChangeToken(user.id, 'confirmed@example.com');

      const res = await request(app).get(`/api/auth/verify-email-change?token=${raw}`);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('emailChanged=true');
      // Web confirmations land on the Settings account tab (LIF-181/LIF-190).
      expect(res.headers.location).toContain('settings/account');
      expect(res.headers.location).not.toContain('/profile');
      expect(res.headers['referrer-policy']).toBe('no-referrer');

      const updated = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updated!.email).toBe('confirmed@example.com');
      expect(updated!.emailVerified).toBe(true);
      expect(updated!.emailVerifiedAt).not.toBeNull();

      const token = await prisma.emailChangeToken.findFirst({ where: { userId: user.id } });
      expect(token!.usedAt).not.toBeNull();

      expect(sendEmailChangedNoticeEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'old@example.com', newEmail: 'confirmed@example.com' })
      );
    });

    it('redirects with invalid-token for an expired token', async () => {
      const user = await createUser();
      const raw = await seedEmailChangeToken(user.id, 'new@example.com', { expiresInMs: -1000 });

      const res = await request(app).get(`/api/auth/verify-email-change?token=${raw}`);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=invalid-token');

      const updated = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updated!.email).toBe(user.email); // unchanged
    });

    it('redirects with invalid-token for an already-used token', async () => {
      const user = await createUser();
      const raw = await seedEmailChangeToken(user.id, 'new@example.com', { usedAt: new Date() });

      const res = await request(app).get(`/api/auth/verify-email-change?token=${raw}`);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=invalid-token');
    });

    it('redirects with invalid-token for an unknown token', async () => {
      await createUser();
      const res = await request(app).get(
        `/api/auth/verify-email-change?token=${crypto.randomBytes(32).toString('base64url')}`
      );

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=invalid-token');
    });

    it('redirects with email-taken when the address was claimed after the token was issued', async () => {
      const user = await createUser('mover@example.com');
      const raw = await seedEmailChangeToken(user.id, 'contested@example.com');
      // Someone else grabs the address before the link is clicked.
      await createUser('contested@example.com');

      const res = await request(app).get(`/api/auth/verify-email-change?token=${raw}`);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=email-taken');

      const updated = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updated!.email).toBe('mover@example.com'); // unchanged
    });

    it('keeps the mobile deep link on the profile screen', async () => {
      const user = await createUser('m-old@example.com');
      const raw = await seedEmailChangeToken(user.id, 'm-new@example.com');

      const res = await request(app).get(
        `/api/auth/verify-email-change?token=${raw}&platform=mobile`
      );

      expect(res.status).toBe(302);
      // The Expo app routes to `profile`; only web moved to settings/account.
      expect(res.headers.location).toContain('profile?emailChanged=true');
      expect(res.headers.location).not.toContain('settings/account');
    });
  });
});
