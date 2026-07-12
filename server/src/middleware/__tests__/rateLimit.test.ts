import express from 'express';
import request from 'supertest';
import { createApiLimiter, apiLimiter } from '../rateLimit';

function buildApp(limiter: ReturnType<typeof createApiLimiter>) {
  const app = express();
  app.use('/api', limiter);
  app.get('/api/ping', (_req, res) => res.json({ ok: true }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  return app;
}

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
