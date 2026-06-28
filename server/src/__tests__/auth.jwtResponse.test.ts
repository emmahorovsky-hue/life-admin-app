// LIF-91: JWT returned in auth response bodies
// Verifies that login and register return a valid `token` in the response body
// (unconditionally, for mobile/Bearer clients that have no cookie yet), and that
// changePassword returns a fresh token only to Bearer callers while rotating the
// session (old token rejected via passwordChangedAt -> SESSION_INVALIDATED).

import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from '../routes/auth';
import prisma from '../utils/db';
import { verifyToken } from '../utils/jwt';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(cors());
  app.use('/api/auth', authRoutes);
  return app;
};

describe('JWT in auth response bodies (LIF-91)', () => {
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

  it('register returns a valid token in the response body', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'reg@example.com',
      password: 'TestPass123!',
      name: 'Reg User',
    });

    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');

    // Token is a genuine, verifiable JWT for the created user.
    const decoded = verifyToken(res.body.token);
    expect(decoded.userId).toBe(res.body.user.id);
    expect(decoded.email).toBe('reg@example.com');

    // And it actually authenticates a protected route.
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${res.body.token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.id).toBe(res.body.user.id);
  });

  it('login returns a valid token in the response body', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'login@example.com',
      password: 'TestPass123!',
      name: 'Login User',
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'login@example.com',
      password: 'TestPass123!',
    });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');

    const decoded = verifyToken(res.body.token);
    expect(decoded.userId).toBe(res.body.user.id);
    expect(decoded.email).toBe('login@example.com');

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${res.body.token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.id).toBe(res.body.user.id);
  });

  describe('changePassword token rotation', () => {
    async function registerAndLogin(email: string) {
      await request(app).post('/api/auth/register').send({
        email,
        password: 'OldPass123!',
        name: 'Pwd User',
      });
      const loginRes = await request(app).post('/api/auth/login').send({
        email,
        password: 'OldPass123!',
      });
      return loginRes.body.token as string;
    }

    it('via Bearer returns a fresh token that authenticates /me while the old token is rejected', async () => {
      const oldToken = await registerAndLogin('rotate@example.com');

      // JWT `iat` and `passwordChangedAt` are both floored to whole seconds, and
      // the invalidation check is strict (`iat < passwordChangedAt/1000`). Wait
      // just over a second so the old token's iat predates the rotation and is
      // therefore rejected, while the freshly issued token survives.
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${oldToken}`)
        .send({ currentPassword: 'OldPass123!', newPassword: 'BrandNew123!' });

      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token).not.toBe(oldToken);

      // The fresh token authenticates a protected route.
      const meWithNew = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${res.body.token}`);
      expect(meWithNew.status).toBe(200);

      // The old token is now rejected because passwordChangedAt was bumped.
      const meWithOld = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${oldToken}`);
      expect(meWithOld.status).toBe(401);
      expect(meWithOld.body.error.code).toBe('SESSION_INVALIDATED');
    });

    it('via cookie (non-Bearer) does not include a token in the body', async () => {
      const token = await registerAndLogin('cookiepwd@example.com');

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', [`token=${token}`])
        .send({ currentPassword: 'OldPass123!', newPassword: 'BrandNew123!' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeUndefined();
    });
  });
});
