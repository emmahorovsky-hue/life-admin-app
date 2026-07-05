// LIF-92: Device token registration for push notifications
// Verifies POST /api/auth/device-token upserts a DeviceToken row keyed on the
// token itself (not [userId, token]) so re-registering a device under a
// different account reassigns ownership rather than duplicating rows.

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

describe('POST /api/auth/device-token', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  async function registerAndLogin(email: string) {
    await request(app).post('/api/auth/register').send({
      email,
      password: 'TestPass123!',
      name: 'Device Token User',
    });
    const loginRes = await request(app).post('/api/auth/login').send({
      email,
      password: 'TestPass123!',
    });
    return { token: loginRes.body.token as string, userId: loginRes.body.user.id as string };
  }

  it('registers a device token for the first time', async () => {
    const user = await registerAndLogin('first@example.com');

    const res = await request(app)
      .post('/api/auth/device-token')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ token: 'expo-tok-first', platform: 'ios' });

    expect(res.status).toBe(200);

    const row = await prisma.deviceToken.findUnique({ where: { token: 'expo-tok-first' } });
    expect(row?.userId).toBe(user.userId);
    expect(row?.platform).toBe('ios');
  });

  it('re-registering the same token from the same user is idempotent', async () => {
    const user = await registerAndLogin('idempotent@example.com');

    await request(app)
      .post('/api/auth/device-token')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ token: 'expo-tok-idempotent', platform: 'android' });

    const res = await request(app)
      .post('/api/auth/device-token')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ token: 'expo-tok-idempotent', platform: 'android' });

    expect(res.status).toBe(200);
    const rows = await prisma.deviceToken.findMany({ where: { token: 'expo-tok-idempotent' } });
    expect(rows).toHaveLength(1);
  });

  it('reassigns the token to a new user when a different account registers it', async () => {
    const userA = await registerAndLogin('deviceowner-a@example.com');
    const userB = await registerAndLogin('deviceowner-b@example.com');

    await request(app)
      .post('/api/auth/device-token')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ token: 'expo-tok-shared-device', platform: 'ios' });

    await request(app)
      .post('/api/auth/device-token')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ token: 'expo-tok-shared-device', platform: 'ios' });

    const row = await prisma.deviceToken.findUnique({ where: { token: 'expo-tok-shared-device' } });
    expect(row?.userId).toBe(userB.userId);
    expect(await prisma.deviceToken.count({ where: { token: 'expo-tok-shared-device' } })).toBe(1);
  });

  it('rejects a request missing the token', async () => {
    const user = await registerAndLogin('missingtoken@example.com');

    const res = await request(app)
      .post('/api/auth/device-token')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ platform: 'ios' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a request with an invalid platform', async () => {
    const user = await registerAndLogin('badplatform@example.com');

    const res = await request(app)
      .post('/api/auth/device-token')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ token: 'expo-tok-badplatform', platform: 'windows' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a non-string platform (e.g. an array) as a 400, not a 500', async () => {
    const user = await registerAndLogin('arrayplatform@example.com');

    const res = await request(app)
      .post('/api/auth/device-token')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ token: 'expo-tok-arrayplatform', platform: ['ios'] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/auth/device-token')
      .send({ token: 'expo-tok-noauth', platform: 'ios' });

    expect(res.status).toBe(401);
  });
});
