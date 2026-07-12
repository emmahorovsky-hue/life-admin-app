// Core auth endpoint coverage: register/login validation failures, /me auth
// gating, and logout cookie clearing. Ported from the orphaned pre-workspace
// suite at server/__tests__/auth.test.ts (LIF-128), which lived outside jest's
// roots and never ran; the happy paths it also covered are exercised elsewhere
// (auth.jwtResponse, auth.emailNormalization, auth.bearer).

import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from '../routes/auth';
import prisma from '../utils/db';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  return app;
};

const registerPayload = {
  email: 'coreuser@example.com',
  password: 'TestPass123!',
  name: 'Core User',
};

describe('Core auth endpoints (LIF-128)', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('POST /api/auth/register', () => {
    it('registers a user, hashes the password, and omits it from the response', async () => {
      const res = await request(app).post('/api/auth/register').send(registerPayload);

      expect(res.status).toBe(201);
      expect(res.body.user.password).toBeUndefined();
      // Register must return the same full `User` shape as login/getMe so the
      // shared type stays honest across all auth paths (LIF-132).
      expect(res.body.user).toEqual({
        id: expect.any(String),
        email: registerPayload.email,
        name: registerPayload.name,
        surname: null,
        emailVerified: false,
        emailVerifiedAt: null,
        reminderEmailsEnabled: true,
        reminderPushEnabled: true,
        timezone: 'UTC',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      const user = await prisma.user.findUnique({ where: { email: registerPayload.email } });
      expect(user).toBeTruthy();
      expect(user?.password).not.toBe(registerPayload.password);
    });

    it('rejects a duplicate email with 400', async () => {
      await request(app).post('/api/auth/register').send(registerPayload);
      const res = await request(app).post('/api/auth/register').send(registerPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 400 EMAIL_EXISTS when a concurrent registration wins the race after the existence check (LIF-145)', async () => {
      // Simulate the create-after-check race deterministically: the email is
      // already taken, but the existence check reports it free (as it would if
      // a concurrent request created the user just after the check). The
      // subsequent `create` then hits the unique constraint (P2002), which
      // must map to the same 400 EMAIL_EXISTS as the check — never a 500.
      await request(app).post('/api/auth/register').send(registerPayload);

      const findSpy = jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(null);
      try {
        const res = await request(app).post('/api/auth/register').send(registerPayload);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('EMAIL_EXISTS');
      } finally {
        findSpy.mockRestore();
      }
    });

    it('rejects an invalid email format with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...registerPayload, email: 'notanemail' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('rejects a weak password with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...registerPayload, password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('rejects missing fields with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: registerPayload.email });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(registerPayload);
    });

    it('logs in with correct credentials and sets the token cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: registerPayload.email, password: registerPayload.password });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(registerPayload.email);
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('token=');
    });

    it('rejects a wrong password with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: registerPayload.email, password: 'WrongPass123!' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('rejects a non-existent email with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: registerPayload.password });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('rejects missing credentials with 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: registerPayload.email });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('GET /api/auth/me', () => {
    let tokenCookie: string;
    let userId: string;

    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(registerPayload);
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: registerPayload.email, password: registerPayload.password });
      tokenCookie = loginRes.headers['set-cookie'][0].split(';')[0];
      userId = loginRes.body.user.id;
    });

    it('returns the current user when authenticated via cookie', async () => {
      const res = await request(app).get('/api/auth/me').set('Cookie', [tokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(userId);
      expect(res.body.user.email).toBe(registerPayload.email);
      expect(res.body.user.password).toBeUndefined();
    });

    it('returns 401 when not authenticated', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('returns 401 for an invalid token', async () => {
      const res = await request(app).get('/api/auth/me').set('Cookie', ['token=invalidtoken']);

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears the auth cookie', async () => {
      await request(app).post('/api/auth/register').send(registerPayload);
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: registerPayload.email, password: registerPayload.password });
      const tokenCookie = loginRes.headers['set-cookie'][0].split(';')[0];

      const res = await request(app).post('/api/auth/logout').set('Cookie', [tokenCookie]);

      expect(res.status).toBe(200);
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('token=;');
    });

    it('succeeds even without an auth token', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(200);
    });
  });
});
