// LIF-93: Bearer token login flow and CSRF bypass for the mobile client.
// Depends on LIF-91 (token in response body) and LIF-89/LIF-92 (Bearer auth + CSRF bypass).

import request from 'supertest';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import jwt from 'jsonwebtoken';
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
    // The mutation actually took effect, not just a 200 short-circuit.
    expect(res.body.user.name).toBe('Updated via Bearer');
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

// ─── Test 3: changePassword re-issues a Bearer token ──────────────────────────

describe('changePassword Bearer token rotation (LIF-91)', () => {
  const app = buildApp();
  const NEW_PASSWORD = 'NewMobilePass456!';

  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(TEST_CREDS);
  });

  it('returns a fresh token that works while the old token is invalidated', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_CREDS.email, password: TEST_CREDS.password });
    const userId: string = loginRes.body.user.id;
    expect(loginRes.body.token).toBeDefined();

    // Backdate the "old" session token by a minute. The controller floors
    // passwordChangedAt to the current second so a token issued in the *same*
    // second survives the change (keeping the active session alive); only tokens
    // with an earlier iat are invalidated. Signing an older iat makes this
    // deterministic regardless of how fast the test runs.
    const oldToken = jwt.sign(
      { userId, email: TEST_CREDS.email, iat: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );

    // Change the password via the Bearer header — the controller branch under test
    // only returns a token in the body when the request is Bearer-authenticated.
    const changeRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ currentPassword: TEST_CREDS.password, newPassword: NEW_PASSWORD });

    expect(changeRes.status).toBe(200);
    const newToken: string = changeRes.body.token;
    expect(typeof newToken).toBe('string');
    expect(newToken.length).toBeGreaterThan(0);

    // The new token authenticates a protected endpoint.
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${newToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(TEST_CREDS.email);

    // The old token is now rejected: it was issued before passwordChangedAt.
    const staleRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldToken}`);
    expect(staleRes.status).toBe(401);
    expect(staleRes.body.error.code).toBe('SESSION_INVALIDATED');
  });
});

// ─── Test 4: Bearer negative / edge cases ─────────────────────────────────────

describe('Bearer auth edge cases (LIF-93)', () => {
  const app = buildApp();

  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(TEST_CREDS);
  });

  function tokenFor(email: string, password: string): Promise<string> {
    return request(app)
      .post('/api/auth/login')
      .send({ email, password })
      .then((res) => res.body.token as string);
  }

  it('rejects an expired Bearer token with 401', async () => {
    const { id: userId } = (
      await request(app).post('/api/auth/login').send({ email: TEST_CREDS.email, password: TEST_CREDS.password })
    ).body.user;

    // Forge a token that is already expired, signed with the same secret.
    const expiredToken = jwt.sign(
      { userId, email: TEST_CREDS.email },
      process.env.JWT_SECRET as string,
      { expiresIn: '-1h' }
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects an Authorization header of "Bearer" with no token value', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer');

    // "Bearer" (no trailing space/value) does not match "Bearer " prefix, so no
    // token is extracted and no cookie is present → UNAUTHORIZED.
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a lowercase "bearer <token>" scheme', async () => {
    const token = await tokenFor(TEST_CREDS.email, TEST_CREDS.password);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `bearer ${token}`);

    // The middleware only recognises the case-sensitive "Bearer " prefix, so the
    // header is ignored and, with no cookie, the request is unauthenticated.
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('Bearer identity wins over a cookie for a different user', async () => {
    // User A: the Bearer identity we expect to win.
    const tokenA = await tokenFor(TEST_CREDS.email, TEST_CREDS.password);

    // User B: a second account whose token we put in the cookie.
    const credsB = { email: 'mobile.other@example.com', password: 'OtherPass789!', name: 'Other User' };
    await request(app).post('/api/auth/register').send(credsB);
    const tokenB = await tokenFor(credsB.email, credsB.password);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Cookie', `token=${tokenB}`);

    // auth.ts prefers the Bearer header over the cookie, so user A is resolved.
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TEST_CREDS.email);
  });
});
