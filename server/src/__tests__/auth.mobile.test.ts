// LIF-93: Bearer token login flow and CSRF bypass for the mobile client.
// Depends on LIF-91 (token in response body) and LIF-89/LIF-92 (Bearer auth + CSRF bypass).

import request from 'supertest';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from '../routes/auth';
import { csrfMiddleware } from '../middleware/csrf';

const originalNodeEnv = process.env.NODE_ENV;

function buildApp(withCsrf = false): Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(cors());
  if (withCsrf) app.use(csrfMiddleware);
  app.use('/api/auth', authRoutes);
  return app;
}

const TEST_CREDS = { email: 'mobile.test@example.com', password: 'MobilePass123!', name: 'Mobile User' };

// ─── Test 1: token in response body ──────────────────────────────────────────

describe('Bearer login flow: token in response body (LIF-91)', () => {
  const app = buildApp();

  // setup.ts beforeEach clears all users before each test; recreate here
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(TEST_CREDS);
  });

  it('register response includes a token string', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'mobile.register@example.com',
      password: 'MobilePass123!',
      name: 'Register User',
    });
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(0);
  });

  it('login response includes a token string', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_CREDS.email, password: TEST_CREDS.password });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(0);
  });

  it('body token authenticates a protected endpoint without any cookie', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_CREDS.email, password: TEST_CREDS.password });

    const { token } = loginRes.body;
    expect(token).toBeDefined();

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    // No Cookie header — proves the body token works standalone

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(TEST_CREDS.email);
  });
});

// ─── Test 2: CSRF bypass for Bearer requests ──────────────────────────────────

describe('CSRF bypass for Bearer requests (LIF-93)', () => {
  // CSRF middleware short-circuits in NODE_ENV=test, so we override it here.
  // The middleware reads NODE_ENV at request time, so flipping it in beforeEach
  // is sufficient — the app instance is shared across tests.
  const app = buildApp(true);

  beforeEach(async () => {
    process.env.NODE_ENV = 'development';
    // setup.ts beforeEach clears all users; register and login are CSRF-exempt paths
    await request(app).post('/api/auth/register').send(TEST_CREDS);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('Bearer request succeeds on a mutating endpoint with no CSRF header', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_CREDS.email, password: TEST_CREDS.password });
    const { token } = loginRes.body;

    const res = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated via Bearer' });

    expect(res.status).toBe(200);
  });

  it('cookie-auth request without CSRF header is blocked with 403', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_CREDS.email, password: TEST_CREDS.password });
    const { token } = loginRes.body;

    const res = await request(app)
      .patch('/api/auth/profile')
      .set('Cookie', `token=${token}`)
      .send({ name: 'Should be blocked' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_VALIDATION_FAILED');
  });
});
