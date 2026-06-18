import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';

// Mock only the extraction call; keep the real ALLOWED_UPLOAD_MIME_TYPES /
// isSupportedMimeType so the receiptUpload middleware's fileFilter still works.
jest.mock('../services/aiService', () => ({
  ...jest.requireActual('../services/aiService'),
  extractSubscription: jest.fn(),
}));

import subscriptionRoutes from '../routes/subscriptions';
import { extractSubscription } from '../services/aiService';
import { generateToken } from '../utils/jwt';

const mockedExtract = extractSubscription as jest.MockedFunction<typeof extractSubscription>;

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/subscriptions', subscriptionRoutes);
  return app;
};

// authenticateToken only verifies the JWT signature (no DB lookup), so an
// arbitrary userId is fine for these tests — nothing is persisted.
function authCookie(userId = 'user-1'): string {
  return `token=${generateToken({ userId, email: `${userId}@example.com` })}`;
}

const SAMPLE_CANDIDATE = {
  name: 'Netflix',
  cost: 15.99,
  currency: 'USD',
  billingCycle: 'monthly',
  renewalDate: '2026-07-01',
  category: 'streaming',
  notes: null,
  isSubscription: true,
  confidence: 'high' as const,
  uncertainFields: [],
};

describe('POST /api/subscriptions/extract', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    mockedExtract.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app)
      .post('/api/subscriptions/extract')
      .attach('file', Buffer.from('%PDF-1.4'), {
        filename: 'r.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ message: expect.any(String), code: expect.any(String) });
    expect(mockedExtract).not.toHaveBeenCalled();
  });

  it('returns 400 NO_FILE when no file is uploaded', async () => {
    const res = await request(app)
      .post('/api/subscriptions/extract')
      .set('Cookie', authCookie());

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'NO_FILE', message: expect.any(String) });
  });

  it('returns 400 UNSUPPORTED_FILE_TYPE for a disallowed mimetype', async () => {
    const res = await request(app)
      .post('/api/subscriptions/extract')
      .set('Cookie', authCookie())
      .attach('file', Buffer.from('hello'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'UNSUPPORTED_FILE_TYPE',
      message: expect.any(String),
    });
    expect(mockedExtract).not.toHaveBeenCalled();
  });

  it('returns 400 FILE_TOO_LARGE when the upload exceeds the 10 MB cap', async () => {
    const tooBig = Buffer.alloc(10 * 1024 * 1024 + 1, 0);
    const res = await request(app)
      .post('/api/subscriptions/extract')
      .set('Cookie', authCookie())
      .attach('file', tooBig, { filename: 'big.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'FILE_TOO_LARGE',
      message: expect.any(String),
    });
    expect(mockedExtract).not.toHaveBeenCalled();
  });

  it('returns 200 with well-formed candidates for a valid upload', async () => {
    mockedExtract.mockResolvedValue({ source: 'ai', candidates: [SAMPLE_CANDIDATE] });

    const res = await request(app)
      .post('/api/subscriptions/extract')
      .set('Cookie', authCookie())
      .attach('file', Buffer.from('%PDF-1.4'), {
        filename: 'r.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ source: 'ai', candidates: [SAMPLE_CANDIDATE] });
    expect(mockedExtract).toHaveBeenCalledTimes(1);
    // Buffer + mimetype are forwarded to the service.
    expect(mockedExtract.mock.calls[0][1]).toBe('application/pdf');
  });

  it('returns 503 EXTRACTION_NOT_CONFIGURED when the service has no key', async () => {
    mockedExtract.mockResolvedValue({ source: 'none', reason: 'not_configured', candidates: [] });

    const res = await request(app)
      .post('/api/subscriptions/extract')
      .set('Cookie', authCookie())
      .attach('file', Buffer.from('%PDF-1.4'), {
        filename: 'r.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatchObject({
      code: 'EXTRACTION_NOT_CONFIGURED',
      message: expect.any(String),
    });
  });

  it('returns 503 EXTRACTION_FAILED when extraction errors at runtime', async () => {
    mockedExtract.mockResolvedValue({ source: 'none', reason: 'error', candidates: [] });

    const res = await request(app)
      .post('/api/subscriptions/extract')
      .set('Cookie', authCookie())
      .attach('file', Buffer.from('%PDF-1.4'), {
        filename: 'r.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatchObject({
      code: 'EXTRACTION_FAILED',
      message: expect.any(String),
    });
  });

  it('returns 429 RATE_LIMITED after 20 requests in the window (per user)', async () => {
    mockedExtract.mockResolvedValue({ source: 'ai', candidates: [SAMPLE_CANDIDATE] });
    // A dedicated user so other tests' requests don't consume this budget.
    const cookie = authCookie('rate-limit-user');

    for (let i = 0; i < 20; i++) {
      const ok = await request(app)
        .post('/api/subscriptions/extract')
        .set('Cookie', cookie)
        .attach('file', Buffer.from('%PDF-1.4'), {
          filename: 'r.pdf',
          contentType: 'application/pdf',
        });
      expect(ok.status).toBe(200);
    }

    const limited = await request(app)
      .post('/api/subscriptions/extract')
      .set('Cookie', cookie)
      .attach('file', Buffer.from('%PDF-1.4'), {
        filename: 'r.pdf',
        contentType: 'application/pdf',
      });

    expect(limited.status).toBe(429);
    expect(limited.body.error).toMatchObject({
      code: 'RATE_LIMITED',
      message: expect.any(String),
    });
  });
});
