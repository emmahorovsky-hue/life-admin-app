import request from 'supertest';
import bcrypt from 'bcryptjs';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import accountRoutes from '../routes/account';
import prisma from '../utils/db';
import { generateToken } from '../utils/jwt';
import * as emailService from '../services/emailService';

// Mocked globally in setup.ts; grab the mock to assert on / override per test.
const sendAccountDeletedEmail = emailService.sendAccountDeletedEmail as jest.Mock;

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(cors());
  app.use('/api/account', accountRoutes);
  return app;
};

const PASSWORD = 'CorrectHorse1!';

describe('DELETE /api/account', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    await prisma.notificationLog.deleteMany({});
    await prisma.user.deleteMany({});
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.notificationLog.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  // A user with one of everything, so the cascade assertions mean something.
  async function createUserWithData(email = 'doomed@example.com') {
    const user = await prisma.user.create({
      data: { email, password: await bcrypt.hash(PASSWORD, 10), emailVerified: true },
    });
    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        name: 'Netflix',
        cost: 15.98,
        currency: 'SGD',
        billingCycle: 'monthly',
        renewalDate: new Date(),
        category: 'streaming',
      },
    });
    await prisma.notificationLog.create({
      data: {
        userId: user.id,
        subscriptionId: subscription.id,
        type: 'renewal_reminder',
        status: 'sent',
        renewalDate: new Date(),
      },
    });
    await prisma.deviceToken.create({
      data: { userId: user.id, token: `tok-${user.id}`, platform: 'ios' },
    });
    await prisma.userAvatar.create({
      data: { userId: user.id, data: Buffer.from('webp-bytes'), mimeType: 'image/webp' },
    });
    return user;
  }

  function authCookie(userId: string, email: string): string {
    return `token=${generateToken({ userId, email })}`;
  }

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).delete('/api/account').send({ password: PASSWORD });
    expect(res.status).toBe(401);
  });

  it('rejects a missing password with VALIDATION_ERROR', async () => {
    const user = await createUserWithData();

    const res = await request(app)
      .delete('/api/account')
      .set('Cookie', authCookie(user.id, user.email))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.user.count()).toBe(1);
  });

  it('rejects a wrong password and leaves everything intact', async () => {
    const user = await createUserWithData();

    const res = await request(app)
      .delete('/api/account')
      .set('Cookie', authCookie(user.id, user.email))
      .send({ password: 'WrongPass1!' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.subscription.count()).toBe(1);
    expect(await prisma.notificationLog.count()).toBe(1);
    expect(sendAccountDeletedEmail).not.toHaveBeenCalled();
  });

  it('deletes the user and every dependent row, clears the cookie, sends the farewell email', async () => {
    const user = await createUserWithData();

    const res = await request(app)
      .delete('/api/account')
      .set('Cookie', authCookie(user.id, user.email))
      .send({ password: PASSWORD });

    expect(res.status).toBe(200);

    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.subscription.count()).toBe(0);
    expect(await prisma.deviceToken.count()).toBe(0);
    expect(await prisma.userAvatar.count()).toBe(0);
    // No FK on NotificationLog — deleted explicitly, would orphan otherwise.
    expect(await prisma.notificationLog.count()).toBe(0);

    expect(sendAccountDeletedEmail).toHaveBeenCalledWith({ to: user.email });

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie.some((c) => c.startsWith('token=;'))).toBe(true);
  });

  it('still deletes the account when the farewell email fails', async () => {
    const user = await createUserWithData();
    sendAccountDeletedEmail.mockRejectedValueOnce(new Error('mailer down'));

    const res = await request(app)
      .delete('/api/account')
      .set('Cookie', authCookie(user.id, user.email))
      .send({ password: PASSWORD });

    expect(res.status).toBe(200);
    expect(await prisma.user.count()).toBe(0);
  });

  it('leaves other users untouched', async () => {
    const doomed = await createUserWithData('doomed@example.com');
    const bystander = await createUserWithData('bystander@example.com');

    const res = await request(app)
      .delete('/api/account')
      .set('Cookie', authCookie(doomed.id, doomed.email))
      .send({ password: PASSWORD });

    expect(res.status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: bystander.id } })).toBeTruthy();
    expect(await prisma.subscription.count()).toBe(1);
    expect(await prisma.notificationLog.count()).toBe(1);
  });
});
