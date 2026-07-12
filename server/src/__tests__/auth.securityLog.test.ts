// Integration coverage for LIF-30: the auth endpoints must emit structured
// security-event JSON lines on stdout (login success/failure, registration,
// password reset). Rate-limit handlers are unit-covered in
// utils/__tests__/securityLog.test.ts — limiters are skipped when
// NODE_ENV=test, so they can't fire here.

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

const registerPayload = {
  email: 'seclog@example.com',
  password: 'TestPass123!',
  name: 'Sec Log',
};

type SecurityEntry = Record<string, unknown>;

describe('Security event logging (LIF-30)', () => {
  let app: express.Application;
  let logSpy: jest.SpyInstance;

  const securityEvents = (): SecurityEntry[] =>
    logSpy.mock.calls
      .map((call) => {
        try {
          return JSON.parse(call[0]);
        } catch {
          return null;
        }
      })
      .filter((entry): entry is SecurityEntry => entry?.type === 'security_event');

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  it('logs auth.register.success on registration with user id and email', async () => {
    const res = await request(app).post('/api/auth/register').send(registerPayload);
    expect(res.status).toBe(201);

    const events = securityEvents();
    expect(events).toContainEqual(
      expect.objectContaining({
        event: 'auth.register.success',
        userId: res.body.user.id,
        email: registerPayload.email,
        ip: expect.any(String),
        timestamp: expect.any(String),
      })
    );
  });

  it('logs auth.login.success on successful login', async () => {
    await request(app).post('/api/auth/register').send(registerPayload);
    logSpy.mockClear();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: registerPayload.email, password: registerPayload.password });
    expect(res.status).toBe(200);

    expect(securityEvents()).toContainEqual(
      expect.objectContaining({ event: 'auth.login.success', email: registerPayload.email })
    );
  });

  it('logs auth.login.failure with reason invalid_password on wrong password', async () => {
    await request(app).post('/api/auth/register').send(registerPayload);
    logSpy.mockClear();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: registerPayload.email, password: 'WrongPass123!' });
    expect(res.status).toBe(401);

    expect(securityEvents()).toContainEqual(
      expect.objectContaining({
        event: 'auth.login.failure',
        reason: 'invalid_password',
        email: registerPayload.email,
      })
    );
  });

  it('logs auth.login.failure with reason unknown_email for an unregistered email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'TestPass123!' });
    expect(res.status).toBe(401);

    expect(securityEvents()).toContainEqual(
      expect.objectContaining({ event: 'auth.login.failure', reason: 'unknown_email' })
    );
  });

  it('never logs the submitted password anywhere', async () => {
    await request(app).post('/api/auth/register').send(registerPayload);
    await request(app)
      .post('/api/auth/login')
      .send({ email: registerPayload.email, password: registerPayload.password });

    const allOutput = JSON.stringify(logSpy.mock.calls);
    expect(allOutput).not.toContain(registerPayload.password);
  });

  it('logs auth.password_reset.failed with the token reason on an invalid token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'not-a-real-token-but-long-enough', password: 'NewPass123!' });
    expect(res.status).toBe(400);

    const events = securityEvents();
    expect(events).toContainEqual(
      expect.objectContaining({ event: 'auth.password_reset.failed', reason: 'invalid' })
    );
    // Token events, not token values.
    expect(JSON.stringify(events)).not.toContain('not-a-real-token-but-long-enough');
  });
});
