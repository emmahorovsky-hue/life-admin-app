import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createApiLimiter, apiLimiter } from '../rateLimit';
import { generateToken } from '../../utils/jwt';

function buildApp(limiter: ReturnType<typeof createApiLimiter>) {
  const app = express();
  // Lets a test claim its own source IP via X-Forwarded-For. Reporting is
  // throttled per bucket and the throttle outlives a single test, so a test
  // that asserts on log output needs an IP bucket no other test has tripped.
  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.use('/api', limiter);
  app.get('/api/ping', (_req, res) => res.json({ ok: true }));
  // Stand-ins for the two halves of the real API, so scope-keying can be
  // exercised without mounting the routers (and their DB dependencies).
  app.post('/api/auth/device-token', (_req, res) => res.json({ ok: true }));
  app.get('/api/subscriptions', (_req, res) => res.json({ ok: true }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  return app;
}

const tokenFor = (userId: string) => generateToken({ userId, email: `${userId}@example.com` });

describe('general API rate limiter', () => {
  it('returns 429 with the standard error shape once the limit is exceeded', async () => {
    const app = buildApp(createApiLimiter({ max: 3, windowMs: 60_000, enabled: true }));

    for (let i = 0; i < 3; i++) {
      await request(app).get('/api/ping').expect(200);
    }

    const res = await request(app).get('/api/ping').expect(429);
    expect(res.body).toEqual({
      error: {
        message: 'Too many requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
      },
    });
    expect(res.headers['ratelimit-limit']).toBe('3');
  });

  it('does not limit routes outside /api', async () => {
    const app = buildApp(createApiLimiter({ max: 1, windowMs: 60_000, enabled: true }));

    await request(app).get('/api/ping').expect(200);
    await request(app).get('/health').expect(200);
    await request(app).get('/health').expect(200);
  });

  it('is skipped in the test environment by default (integration suites are unaffected)', async () => {
    const app = buildApp(apiLimiter);

    for (let i = 0; i < 10; i++) {
      await request(app).get('/api/ping').expect(200);
    }
  });

  // LIF-240: behind the Vercel → Railway proxy chain every browser request
  // shares a source IP, so the bucket has to key on the account instead.
  describe('bucket keying', () => {
    it('gives two authenticated users independent budgets from one IP', async () => {
      const app = buildApp(createApiLimiter({ max: 2, windowMs: 60_000, enabled: true }));
      const alice = tokenFor('alice');
      const bob = tokenFor('bob');

      await request(app).get('/api/ping').set('Authorization', `Bearer ${alice}`).expect(200);
      await request(app).get('/api/ping').set('Authorization', `Bearer ${alice}`).expect(200);
      await request(app).get('/api/ping').set('Authorization', `Bearer ${alice}`).expect(429);

      // Bob shares Alice's IP but not her bucket — the whole point of the fix.
      await request(app).get('/api/ping').set('Authorization', `Bearer ${bob}`).expect(200);
      await request(app).get('/api/ping').set('Authorization', `Bearer ${bob}`).expect(200);
      await request(app).get('/api/ping').set('Authorization', `Bearer ${bob}`).expect(429);
    });

    it('keys on the cookie token too, so web and mobile behave alike', async () => {
      const app = buildApp(createApiLimiter({ max: 2, windowMs: 60_000, enabled: true }));
      const carol = `token=${tokenFor('carol')}`;
      const dave = `token=${tokenFor('dave')}`;

      await request(app).get('/api/ping').set('Cookie', carol).expect(200);
      await request(app).get('/api/ping').set('Cookie', carol).expect(200);
      await request(app).get('/api/ping').set('Cookie', carol).expect(429);

      await request(app).get('/api/ping').set('Cookie', dave).expect(200);
    });

    it('shares one bucket across a single user\'s requests regardless of transport', async () => {
      const app = buildApp(createApiLimiter({ max: 2, windowMs: 60_000, enabled: true }));
      const token = tokenFor('erin');

      await request(app).get('/api/ping').set('Authorization', `Bearer ${token}`).expect(200);
      await request(app).get('/api/ping').set('Cookie', `token=${token}`).expect(200);
      await request(app).get('/api/ping').set('Authorization', `Bearer ${token}`).expect(429);
    });

    it('falls back to the IP bucket for unauthenticated requests', async () => {
      const app = buildApp(createApiLimiter({ max: 2, windowMs: 60_000, enabled: true }));

      await request(app).get('/api/ping').expect(200);
      await request(app).get('/api/ping').expect(200);
      await request(app).get('/api/ping').expect(429);
    });

    it('falls back to the IP bucket for a forged or expired token', async () => {
      const app = buildApp(createApiLimiter({ max: 2, windowMs: 60_000, enabled: true }));

      // A garbage token must not throw out of the key generator, and must not
      // mint an attacker-controlled bucket key either.
      await request(app).get('/api/ping').set('Authorization', 'Bearer not-a-jwt').expect(200);
      await request(app).get('/api/ping').set('Authorization', 'Bearer also-not-a-jwt').expect(200);
      await request(app).get('/api/ping').set('Authorization', 'Bearer third-bad-token').expect(429);
    });

    it('does not let an authenticated user consume the anonymous IP budget', async () => {
      const app = buildApp(createApiLimiter({ max: 2, windowMs: 60_000, enabled: true }));
      const frank = tokenFor('frank');

      await request(app).get('/api/ping').set('Authorization', `Bearer ${frank}`).expect(200);
      await request(app).get('/api/ping').set('Authorization', `Bearer ${frank}`).expect(200);

      // Frank is exhausted; anonymous traffic from the same IP is untouched.
      await request(app).get('/api/ping').set('Authorization', `Bearer ${frank}`).expect(429);
      await request(app).get('/api/ping').expect(200);
    });
  });

  // The incident this guards against: a mobile build looped on
  // POST /api/auth/device-token, and because one bucket covered the whole API,
  // the user's own subscription screens started answering 429.
  describe('route-group scoping', () => {
    it('keeps an auth flood from draining the same user\'s app budget', async () => {
      const app = buildApp(createApiLimiter({ max: 2, windowMs: 60_000, enabled: true }));
      const token = tokenFor('grace');
      const auth = (path: string) => request(app).post(path).set('Authorization', `Bearer ${token}`);

      await auth('/api/auth/device-token').expect(200);
      await auth('/api/auth/device-token').expect(200);
      await auth('/api/auth/device-token').expect(429);

      // The auth half is spent; the data half is untouched.
      await request(app)
        .get('/api/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('scopes the anonymous IP bucket the same way', async () => {
      const app = buildApp(createApiLimiter({ max: 1, windowMs: 60_000, enabled: true }));

      await request(app).post('/api/auth/device-token').expect(200);
      await request(app).post('/api/auth/device-token').expect(429);
      await request(app).get('/api/subscriptions').expect(200);
    });
  });

  describe('reporting', () => {
    it('logs a security event naming the route and bucket, and sends Retry-After', async () => {
      const app = buildApp(createApiLimiter({ max: 1, windowMs: 60_000, enabled: true }));
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      try {
        const token = tokenFor('heidi');
        await request(app).get('/api/subscriptions').set('Authorization', `Bearer ${token}`).expect(200);
        const res = await request(app)
          .get('/api/subscriptions')
          .set('Authorization', `Bearer ${token}`)
          .expect(429);

        expect(res.headers['retry-after']).toBeDefined();

        const entries = logSpy.mock.calls.map(([line]) => JSON.parse(line as string));
        expect(entries).toContainEqual(
          expect.objectContaining({
            type: 'security_event',
            event: 'api.rate_limit.exceeded',
            route: '/api/subscriptions',
            reason: 'user_bucket',
            userId: 'heidi',
          }),
        );
      } finally {
        logSpy.mockRestore();
      }
    });

    it('reports a bucket once, not once per rejected request', async () => {
      const app = buildApp(createApiLimiter({ max: 1, windowMs: 60_000, enabled: true }));
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      try {
        const token = tokenFor('ivan');
        const call = () =>
          request(app).get('/api/subscriptions').set('Authorization', `Bearer ${token}`);

        await call().expect(200);
        for (let i = 0; i < 5; i++) await call().expect(429);

        const trips = logSpy.mock.calls
          .map(([line]) => JSON.parse(line as string))
          .filter((entry) => entry.event === 'api.rate_limit.exceeded');
        expect(trips).toHaveLength(1);
      } finally {
        logSpy.mockRestore();
      }
    });

    it('records the IP bucket for unauthenticated traffic', async () => {
      const app = buildApp(createApiLimiter({ max: 1, windowMs: 60_000, enabled: true }));
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      try {
        const anon = () => request(app).get('/api/ping').set('X-Forwarded-For', '203.0.113.7');
        await anon().expect(200);
        await anon().expect(429);

        const trips = logSpy.mock.calls
          .map(([line]) => JSON.parse(line as string))
          .filter((entry) => entry.event === 'api.rate_limit.exceeded');
        expect(trips).toHaveLength(1);
        expect(trips[0].reason).toBe('ip_bucket');
        expect(trips[0].userId).toBeUndefined();
      } finally {
        logSpy.mockRestore();
      }
    });
  });

  it('ignores DISABLE_RATE_LIMIT when NODE_ENV is production', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalDisable = process.env.DISABLE_RATE_LIMIT;
    process.env.NODE_ENV = 'production';
    process.env.DISABLE_RATE_LIMIT = 'true';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      jest.resetModules();
      // Re-import so the module re-reads the env at load time, as it does in prod.
      const { createApiLimiter: createProdLimiter } = require('../rateLimit') as typeof import('../rateLimit');
      const app = buildApp(createProdLimiter({ max: 1, windowMs: 60_000 }));

      await request(app).get('/api/ping').expect(200);
      await request(app).get('/api/ping').expect(429);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ignoring it'));
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.DISABLE_RATE_LIMIT = originalDisable === undefined ? undefined : originalDisable;
      if (originalDisable === undefined) delete process.env.DISABLE_RATE_LIMIT;
      warnSpy.mockRestore();
      jest.resetModules();
    }
  });
});
