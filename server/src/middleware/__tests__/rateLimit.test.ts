import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import {
  createApiLimiter,
  apiLimiter,
  authenticatedUserKey,
  emailOrIpKey,
  __resetRateLimitReporting,
} from '../rateLimit';
import { generateToken } from '../../utils/jwt';
import type { Request } from 'express';
import type { AuthRequest } from '../auth';

// The report-dedup map is module state shared by every test in this file.
// Clearing it between tests is what lets them assert on log output without
// having to pick a bucket identity no earlier test happened to trip.
beforeEach(() => __resetRateLimitReporting());

function buildApp(limiter: ReturnType<typeof createApiLimiter>) {
  const app = express();
  // Lets a test claim its own source IP via X-Forwarded-For.
  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.use('/api', limiter);
  app.get('/api/ping', (_req, res) => res.json({ ok: true }));
  // Stand-ins for each scope of the real API, so scope-keying can be exercised
  // without mounting the routers (and their DB dependencies).
  app.post('/api/auth/device-token', (_req, res) => res.json({ ok: true }));
  app.get('/api/auth/me', (_req, res) => res.json({ ok: true }));
  app.post('/api/auth/login', (_req, res) => res.json({ ok: true }));
  app.post('/api/auth/register', (_req, res) => res.json({ ok: true }));
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

      // The device scope is spent; the data half is untouched.
      await request(app)
        .get('/api/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    // The half of the incident the first split did not fix: device-token used to
    // share a bucket with /auth/me and /auth/login, so the same flood emptied it
    // in ~2.4s at the observed rate and then 429'd session restore and sign-in on
    // every device the account was on — with no way back in from either client,
    // since both attach the stale credential to the login request.
    it('keeps a device-token flood from locking the user out of their session', async () => {
      const app = buildApp(createApiLimiter({ max: 2, windowMs: 60_000, enabled: true }));
      const token = tokenFor('nadia');
      const bearer = `Bearer ${token}`;

      for (let i = 0; i < 2; i++) {
        await request(app).post('/api/auth/device-token').set('Authorization', bearer).expect(200);
      }
      await request(app).post('/api/auth/device-token').set('Authorization', bearer).expect(429);

      await request(app).get('/api/auth/me').set('Authorization', bearer).expect(200);
      await request(app).post('/api/auth/login').set('Authorization', bearer).expect(200);
      await request(app).get('/api/subscriptions').set('Authorization', bearer).expect(200);
    });

    it('keeps session traffic and the rest of the auth surface apart', async () => {
      const app = buildApp(createApiLimiter({ max: 1, windowMs: 60_000, enabled: true }));
      const bearer = `Bearer ${tokenFor('omar')}`;

      await request(app).post('/api/auth/register').set('Authorization', bearer).expect(200);
      await request(app).post('/api/auth/register').set('Authorization', bearer).expect(429);

      // Signing in still works even with the credential surface spent.
      await request(app).post('/api/auth/login').set('Authorization', bearer).expect(200);
    });

    // Express matches mounts and routes case-insensitively, so /API/auth/... hits
    // the auth router exactly like the canonical spelling. A case-sensitive scope
    // comparison filed it under `app` and handed it the data budget — the
    // isolation above silently off for any client that varied the case.
    it('scopes case-variant auth paths as auth, not app', async () => {
      const app = buildApp(createApiLimiter({ max: 2, windowMs: 60_000, enabled: true }));
      const bearer = `Bearer ${tokenFor('petra')}`;

      await request(app).post('/API/auth/device-token').set('Authorization', bearer).expect(200);
      await request(app).post('/api/AUTH/device-token').set('Authorization', bearer).expect(200);

      // Both spellings landed in the device bucket, so the data budget is intact.
      await request(app).get('/api/subscriptions').set('Authorization', bearer).expect(200);
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

// `device-token` moved from an IP bucket to this one, so that a single looping
// device could no longer throttle every other user behind the same carrier NAT.
// The switch is only sound while the limiter runs *after* authenticateToken:
// with no verified user on the request it silently falls back to the IP bucket,
// which is the behaviour it was moved away from, and nothing about the route
// makes that ordering visible.
describe('authenticatedUserKey', () => {
  const reqWith = (over: Partial<AuthRequest>) => over as AuthRequest;

  it('buckets on the authenticated user', () => {
    const key = authenticatedUserKey(reqWith({ user: { userId: 'u1', email: 'u1@x.com' } }));
    expect(key).toBe('user:u1');
  });

  it('gives two users behind one IP separate buckets', () => {
    const ip = '203.0.113.9';
    const a = authenticatedUserKey(reqWith({ user: { userId: 'u1', email: 'u1@x.com' }, ip }));
    const b = authenticatedUserKey(reqWith({ user: { userId: 'u2', email: 'u2@x.com' }, ip }));
    expect(a).not.toBe(b);
  });

  it('falls back to the IP bucket when no user is on the request', () => {
    // i.e. the limiter was mounted before authenticateToken. Documented rather
    // than desired — the key is still well-formed and namespaced, but the
    // per-user isolation above is gone.
    const key = authenticatedUserKey(reqWith({ ip: '203.0.113.9' }));
    expect(key).toMatch(/^ip:/);
    expect(key).not.toMatch(/^user:/);
  });

  it('namespaces user keys so a user id cannot collide with an IP literal', () => {
    const asUser = authenticatedUserKey(
      reqWith({ user: { userId: '203.0.113.9', email: 'u@x.com' } }),
    );
    const asIp = authenticatedUserKey(reqWith({ ip: '203.0.113.9' }));
    expect(asUser).not.toBe(asIp);
  });
});

// Unit tests because nothing else can reach this. The per-email limiters that
// use it are mounted before the validation chain and skipped wholesale under
// NODE_ENV=test, and express-rate-limit runs `skip` before `keyGenerator` — so
// an integration test against /auth/forgot-password never executes a line of it.
describe('emailOrIpKey', () => {
  const reqWith = (over: Partial<Request>) => over as Request;
  const ip = '203.0.113.9';

  it('gives every spelling of one Gmail inbox the same bucket', () => {
    // The bug this fixes: keying on the typed string let a sender walk past the
    // 1/min and 5/hour caps by re-dotting the address, aiming an unmetered mail
    // bomb at one known inbox.
    const spellings = [
      'first.last@gmail.com',
      'firstlast@gmail.com',
      'f.i.r.s.t.last@gmail.com',
      'firstlast+signup@gmail.com',
      'first.last@googlemail.com',
      'First.Last@Gmail.com',
    ];

    const keys = spellings.map((email) => emailOrIpKey(reqWith({ body: { email }, ip })));
    expect(new Set(keys)).toEqual(new Set(['email:firstlast@gmail.com']));
  });

  it('keeps genuinely different inboxes in separate buckets', () => {
    const a = emailOrIpKey(reqWith({ body: { email: 'first.last@gmail.com' }, ip }));
    const b = emailOrIpKey(reqWith({ body: { email: 'someone.else@gmail.com' }, ip }));
    expect(a).not.toBe(b);

    // Dots are only insignificant at Gmail. Folding them everywhere would put
    // two unrelated accounts on one budget.
    const c = emailOrIpKey(reqWith({ body: { email: 'a.b@example.com' }, ip }));
    const d = emailOrIpKey(reqWith({ body: { email: 'ab@example.com' }, ip }));
    expect(c).not.toBe(d);
  });

  it.each([
    ['a number', 123],
    ['an object', { toString: () => 'x@y.com' }],
    ['an array', ['x@y.com']],
    ['null', null],
    ['a string that is not an address', 'not-an-email'],
  ])('falls back to the IP bucket when email is %s', (_label, email) => {
    // This runs before any validator, so the body is whatever was posted. The
    // fallback is what keeps `{"email": 123}` from being an unauthenticated 500.
    expect(emailOrIpKey(reqWith({ body: { email }, ip }))).toBe(`ip:${ip}`);
  });

  it('falls back to the IP bucket when there is no body at all', () => {
    expect(emailOrIpKey(reqWith({ ip }))).toBe(`ip:${ip}`);
    expect(emailOrIpKey(reqWith({ body: {}, ip }))).toBe(`ip:${ip}`);
  });

  it('namespaces email keys so a crafted address cannot land in the IP key space', () => {
    // Without the prefixes, an attacker who could make the canonical form equal
    // an IP literal would share — and could exhaust — the bucket every
    // anonymous caller from that address draws on.
    const crafted = emailOrIpKey(reqWith({ body: { email: `${ip}@example.com` }, ip: '198.51.100.7' }));
    const asIp = emailOrIpKey(reqWith({ ip }));

    expect(crafted).not.toBe(asIp);
    expect(crafted).toMatch(/^email:/);
    expect(asIp).toMatch(/^ip:/);
  });
});
