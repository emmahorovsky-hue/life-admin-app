// LIF-89: Bearer token authentication
// Verifies that authenticateToken accepts Authorization: Bearer <token>
// in addition to the existing httpOnly cookie, without breaking cookie auth.

import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from '../routes/auth';
import prisma from '../utils/db';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(cors());
  app.use('/api/auth', authRoutes);
  return app;
};

describe('Bearer token authentication (LIF-89)', () => {
  let app: express.Application;
  let bearerToken: string;
  let userId: string;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({});

    await request(app).post('/api/auth/register').send({
      email: 'bearer@example.com',
      password: 'TestPass123!',
      name: 'Bearer User',
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'bearer@example.com',
      password: 'TestPass123!',
    });

    // Extract the raw JWT from the httpOnly cookie
    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    bearerToken = cookies[0].split(';')[0].split('=')[1];
    userId = loginRes.body.user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  it('authenticates via Authorization: Bearer header', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${bearerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(userId);
    expect(res.body.user.email).toBe('bearer@example.com');
  });

  it('still authenticates via cookie (backward-compatible)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`token=${bearerToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(userId);
  });

  it('returns 401 with an invalid Bearer token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns 401 with no token at all', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
