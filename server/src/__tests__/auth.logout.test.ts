// Logout must actually revoke the session, not just drop the client's cookie
// (LIF-174). The JWT is stateless, so `User.sessionsValidFrom` is what kills it:
// authenticateToken rejects any token whose `iat` predates that stamp.

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

const credentials = { email: 'logoutuser@example.com', password: 'TestPass123!' };

// JWT `iat` has one-second resolution, and sessionsValidFrom is floored to the
// second, so a token minted in the *same* second as the logout is deliberately
// honoured (see middleware/auth.ts). Real users never log in and out inside one
// second; a test that registers and immediately logs out does. Cross a second
// boundary so these tests exercise the real case rather than that edge.
const crossSecondBoundary = () => new Promise((resolve) => setTimeout(resolve, 1100));

describe('Logout revokes the session (LIF-174)', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  const registerAndGetToken = async (email = credentials.email): Promise<string> => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...credentials, email, name: 'Logout User' });
    expect(res.status).toBe(201);
    return res.body.token;
  };

  const login = async (email = credentials.email): Promise<string> => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: credentials.password });
    expect(res.status).toBe(200);
    return res.body.token;
  };

  const getMe = (token: string) =>
    request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

  it('rejects the token it was called with (the whole point)', async () => {
    const token = await registerAndGetToken();

    // Sanity: the token works before logout.
    expect((await getMe(token)).status).toBe(200);

    await crossSecondBoundary();
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`).expect(200);

    // The same token string, replayed. Before LIF-174 this still returned 200
    // for up to seven days.
    const after = await getMe(token);
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('SESSION_INVALIDATED');
  });

  it('revokes via the cookie path too, not just the Bearer header', async () => {
    const token = await registerAndGetToken('logout-cookie@example.com');

    await crossSecondBoundary();
    await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [`token=${token}`])
      .expect(200);

    expect((await getMe(token)).status).toBe(401);
  });

  it('kills sessions on other devices — revocation is account-wide', async () => {
    // Two independent logins for one user: think phone and laptop.
    await registerAndGetToken('logout-multi@example.com');
    const phone = await login('logout-multi@example.com');
    const laptop = await login('logout-multi@example.com');

    expect((await getMe(phone)).status).toBe(200);
    expect((await getMe(laptop)).status).toBe(200);

    await crossSecondBoundary();
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${phone}`).expect(200);

    // Deliberate: sessionsValidFrom is a whole-account stamp, so logging out on
    // the phone signs the laptop out too. Documented here so a future change to
    // per-device revocation trips this test rather than passing silently.
    expect((await getMe(phone)).status).toBe(401);
    expect((await getMe(laptop)).status).toBe(401);
  });

  it('lets the user log straight back in within the same second', async () => {
    // Regression guard for the LIF-126 bug class. JWT `iat` is whole seconds, so
    // an unfloored sessionsValidFrom (e.g. …:07.812) would be "newer" than the
    // iat of a token minted milliseconds later in the same second (…:07.000) —
    // and the fresh login would be rejected on arrival, locking the user out of
    // their own account. sessionsValidFromNow() floors to the second.
    const token = await registerAndGetToken('logout-relogin@example.com');
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`).expect(200);

    const fresh = await login('logout-relogin@example.com');
    const res = await getMe(fresh);
    expect(res.status).toBe(200);
  });

  it('honours a token minted in the same second as the logout (known 1s granularity)', async () => {
    // Pinning a deliberate limit, not asserting desirable behaviour. `iat` is
    // whole seconds, so a token from the same second as the cutoff cannot be
    // told apart from one issued just after it — and honouring it is what keeps
    // the same-second re-login above working. If someone tightens the middleware
    // comparison to <=, this test fails and sends them to LIF-126 first.
    const token = await registerAndGetToken('logout-samesecond@example.com');
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`).expect(200);

    expect((await getMe(token)).status).toBe(200);
  });

  it('is idempotent: no token, garbage token, and double logout all return 200', async () => {
    await request(app).post('/api/auth/logout').expect(200);
    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', 'Bearer not-a-real-jwt')
      .expect(200);

    const token = await registerAndGetToken('logout-idempotent@example.com');
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`).expect(200);
    // Second call with the now-revoked token: still 200, never 401. Clients await
    // this before clearing local state, so a failure here would strand them.
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`).expect(200);
  });

  it('still clears the auth cookie', async () => {
    const token = await registerAndGetToken('logout-cookieclear@example.com');
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined;
    expect(setCookie?.some((c) => c.startsWith('token=;'))).toBe(true);
  });

  it('leaves passwordChangedAt revocation working', async () => {
    // The two cutoffs are independent; the middleware takes whichever is later.
    // A logout must not mask a password-change invalidation, or vice versa.
    const email = 'logout-pwchange@example.com';
    const token = await registerAndGetToken(email);
    const user = await prisma.user.findUnique({ where: { email } });

    await prisma.user.update({
      where: { id: user!.id },
      data: { passwordChangedAt: new Date(Date.now() + 5000) },
    });

    const res = await getMe(token);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_INVALIDATED');
  });
});
