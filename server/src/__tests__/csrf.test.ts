import request from 'supertest';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import { csrfMiddleware } from '../middleware/csrf';

// The middleware short-circuits when NODE_ENV=test (so the other suites need no
// CSRF headers). These tests deliberately override that to exercise the real
// validation path, restoring it afterwards.
const originalNodeEnv = process.env.NODE_ENV;

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(csrfMiddleware);
  app.get('/api/safe', (_req, res) => res.json({ ok: true }));
  app.post('/api/mutate', (_req, res) => res.json({ ok: true }));
  app.post('/api/auth/login', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('csrfMiddleware', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'development';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('sets the csrf_token cookie and x-csrf-token header on a safe request', async () => {
    const res = await request(buildApp()).get('/api/safe');

    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie.some((c) => c.startsWith('csrf_token='))).toBe(true);
    expect(res.headers['x-csrf-token']).toMatch(/^[a-f0-9]{64}$/);
  });

  it('lets safe methods through without a token', async () => {
    const res = await request(buildApp()).get('/api/safe');
    expect(res.status).toBe(200);
  });

  it('rejects a mutating request with no token (403)', async () => {
    const res = await request(buildApp()).post('/api/mutate').send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_VALIDATION_FAILED');
  });

  it('rejects a mutating request whose header does not match the cookie (403)', async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await agent.get('/api/safe'); // primes the cookie

    const res = await agent.post('/api/mutate').set('x-csrf-token', 'wrong').send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_VALIDATION_FAILED');
  });

  it('accepts a mutating request when the header matches the cookie (200)', async () => {
    const app = buildApp();
    const agent = request.agent(app);
    const primed = await agent.get('/api/safe');
    const token = primed.headers['x-csrf-token'];

    const res = await agent.post('/api/mutate').set('x-csrf-token', token).send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('exempts pre-auth routes so a fresh browser can log in', async () => {
    const res = await request(buildApp()).post('/api/auth/login').send({});
    expect(res.status).toBe(200);
  });

  it('bypasses CSRF validation for Bearer token requests', async () => {
    const res = await request(buildApp())
      .post('/api/mutate')
      .set('Authorization', 'Bearer some.jwt.token')
      .send({});
    expect(res.status).toBe(200);
  });

  it('returns 403 (not 500) for a non-ASCII header of equal string length', async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await agent.get('/api/safe'); // 64-char hex cookie

    // 64 'ÿ' chars: valid latin1 header value, same string length as the 64-char
    // hex cookie, but each encodes to 2 UTF-8 bytes → byte length differs.
    const res = await agent
      .post('/api/mutate')
      .set('x-csrf-token', 'ÿ'.repeat(64))
      .send({});
    expect(res.status).toBe(403);
  });
});
