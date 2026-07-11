import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';

import subscriptionRoutes from '../routes/subscriptions';
import { generateToken } from '../utils/jwt';
import prisma from '../utils/db';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/subscriptions', subscriptionRoutes);
  return app;
};

function authCookie(userId: string, email: string): string {
  return `token=${generateToken({ userId, email })}`;
}

// Create a user and one already soft-deleted subscription owned by them.
async function seedUserWithDeletedSubscription() {
  const user = await prisma.user.create({
    data: {
      email: `softdel-${Date.now()}-${Math.random()}@example.com`,
      password: 'hashed',
    },
  });
  const sub = await prisma.subscription.create({
    data: {
      userId: user.id,
      name: 'Netflix',
      cost: '15.99',
      currency: 'USD',
      billingCycle: 'monthly',
      renewalDate: new Date(),
      category: 'streaming',
      isActive: false,
    },
  });
  return { user, sub };
}

describe('soft-deleted subscriptions are unreachable by id (LIF-146)', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  it('GET /:id returns 404 for a soft-deleted subscription', async () => {
    const { user, sub } = await seedUserWithDeletedSubscription();
    const res = await request(app)
      .get(`/api/subscriptions/${sub.id}`)
      .set('Cookie', authCookie(user.id, user.email));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SUBSCRIPTION_NOT_FOUND');
  });

  it('PUT /:id returns 404 and does not modify a soft-deleted subscription', async () => {
    const { user, sub } = await seedUserWithDeletedSubscription();
    const res = await request(app)
      .put(`/api/subscriptions/${sub.id}`)
      .set('Cookie', authCookie(user.id, user.email))
      .send({ name: 'Resurrected' });
    expect(res.status).toBe(404);

    const stored = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(stored?.name).toBe('Netflix');
  });

  it('DELETE /:id returns 404 for an already soft-deleted subscription', async () => {
    const { user, sub } = await seedUserWithDeletedSubscription();
    const res = await request(app)
      .delete(`/api/subscriptions/${sub.id}`)
      .set('Cookie', authCookie(user.id, user.email));
    expect(res.status).toBe(404);
  });

  it('POST /:id/cancel returns 404 and does not set cancelledAt', async () => {
    const { user, sub } = await seedUserWithDeletedSubscription();
    const res = await request(app)
      .post(`/api/subscriptions/${sub.id}/cancel`)
      .set('Cookie', authCookie(user.id, user.email));
    expect(res.status).toBe(404);

    const stored = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(stored?.cancelledAt).toBeNull();
  });

  it('POST /:id/resume returns 404 for a soft-deleted subscription', async () => {
    const { user, sub } = await seedUserWithDeletedSubscription();
    const res = await request(app)
      .post(`/api/subscriptions/${sub.id}/resume`)
      .set('Cookie', authCookie(user.id, user.email));
    expect(res.status).toBe(404);
  });

  it('an active subscription is still reachable by id', async () => {
    const { user, sub } = await seedUserWithDeletedSubscription();
    const active = await prisma.subscription.create({
      data: {
        userId: user.id,
        name: 'Spotify',
        cost: '9.99',
        currency: 'USD',
        billingCycle: 'monthly',
        renewalDate: new Date(),
        category: 'streaming',
      },
    });

    const res = await request(app)
      .get(`/api/subscriptions/${active.id}`)
      .set('Cookie', authCookie(user.id, user.email));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(active.id);
    expect(res.body.id).not.toBe(sub.id);
  });
});
