import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';

import subscriptionRoutes from '../routes/subscriptions';
import dashboardRoutes from '../routes/dashboard';
import { generateToken } from '../utils/jwt';
import prisma from '../utils/db';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/subscriptions', subscriptionRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  return app;
};

function authCookie(userId: string, email: string): string {
  return `token=${generateToken({ userId, email })}`;
}

// Create a user and one subscription owned by them. renewalDate defaults to a
// few months in the past so computeNextRenewal rolls it forward to a future date.
async function seedUserWithSubscription(overrides: { renewalDate?: Date } = {}) {
  const user = await prisma.user.create({
    data: { email: `cancel-${Date.now()}-${Math.random()}@example.com`, password: 'hashed' },
  });
  const renewalDate =
    overrides.renewalDate ?? new Date(Date.now() - 1000 * 60 * 60 * 24 * 70); // ~70 days ago
  const sub = await prisma.subscription.create({
    data: {
      userId: user.id,
      name: 'Netflix',
      cost: '15.99',
      currency: 'USD',
      billingCycle: 'monthly',
      renewalDate,
      category: 'streaming',
    },
  });
  return { user, sub };
}

describe('subscription cancel / resume', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).post('/api/subscriptions/some-id/cancel');
    expect(res.status).toBe(401);
  });

  it('returns 404 when cancelling another user\'s subscription', async () => {
    const { sub } = await seedUserWithSubscription();
    const res = await request(app)
      .post(`/api/subscriptions/${sub.id}/cancel`)
      .set('Cookie', authCookie('someone-else', 'else@example.com'));
    expect(res.status).toBe(404);
  });

  it('cancel sets cancelledAt and freezes the period end in the future', async () => {
    const { user, sub } = await seedUserWithSubscription();

    const res = await request(app)
      .post(`/api/subscriptions/${sub.id}/cancel`)
      .set('Cookie', authCookie(user.id, user.email));

    expect(res.status).toBe(200);
    expect(res.body.cancelledAt).not.toBeNull();
    // The frozen period end (nextRenewalDate) should be today or later — the sub
    // stays active until then ("cancelling"), it isn't immediately ended.
    expect(new Date(res.body.nextRenewalDate).getTime()).toBeGreaterThanOrEqual(
      new Date(new Date().toISOString().slice(0, 10)).getTime()
    );

    const stored = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(stored?.cancelledAt).not.toBeNull();
    expect(stored?.isActive).toBe(true); // cancel is not delete
  });

  it('does not roll the frozen period end forward on subsequent reads', async () => {
    const { user, sub } = await seedUserWithSubscription();
    const cancelRes = await request(app)
      .post(`/api/subscriptions/${sub.id}/cancel`)
      .set('Cookie', authCookie(user.id, user.email));
    const frozen = cancelRes.body.nextRenewalDate;

    const listRes = await request(app)
      .get('/api/subscriptions')
      .set('Cookie', authCookie(user.id, user.email));
    const listed = listRes.body.find((s: { id: string }) => s.id === sub.id);

    expect(listed).toBeDefined(); // cancelled subs stay visible
    expect(listed.nextRenewalDate).toBe(frozen); // frozen, not advanced
  });

  it('resume clears cancelledAt', async () => {
    const { user, sub } = await seedUserWithSubscription();
    await request(app)
      .post(`/api/subscriptions/${sub.id}/cancel`)
      .set('Cookie', authCookie(user.id, user.email));

    const res = await request(app)
      .post(`/api/subscriptions/${sub.id}/resume`)
      .set('Cookie', authCookie(user.id, user.email));

    expect(res.status).toBe(200);
    expect(res.body.cancelledAt).toBeNull();

    const stored = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(stored?.cancelledAt).toBeNull();
  });

  it('excludes cancelled subscriptions from the dashboard summary', async () => {
    const { user, sub } = await seedUserWithSubscription();

    const before = await request(app)
      .get('/api/dashboard/summary')
      .set('Cookie', authCookie(user.id, user.email));
    expect(before.body.activeSubscriptions).toBe(1);
    // Totals are decimal strings (LIF-125).
    expect(parseFloat(before.body.totalMonthlySpend)).toBeGreaterThan(0);

    await request(app)
      .post(`/api/subscriptions/${sub.id}/cancel`)
      .set('Cookie', authCookie(user.id, user.email));

    const after = await request(app)
      .get('/api/dashboard/summary')
      .set('Cookie', authCookie(user.id, user.email));
    expect(after.body.activeSubscriptions).toBe(0);
    expect(after.body.totalMonthlySpend).toBe('0.00');
  });

  it('serializes cost as a decimal string on create, list, and get (LIF-125)', async () => {
    const { user, sub } = await seedUserWithSubscription();
    const cookie = authCookie(user.id, user.email);

    const created = await request(app)
      .post('/api/subscriptions')
      .set('Cookie', cookie)
      .send({
        name: 'Spotify',
        cost: 9.99,
        currency: 'USD',
        billingCycle: 'monthly',
        renewalDate: new Date().toISOString(),
        category: 'music',
      });
    expect(created.status).toBe(201);
    expect(created.body.cost).toBe('9.99');

    const list = await request(app).get('/api/subscriptions').set('Cookie', cookie);
    expect(list.status).toBe(200);
    for (const row of list.body) {
      expect(typeof row.cost).toBe('string');
    }

    const single = await request(app)
      .get(`/api/subscriptions/${sub.id}`)
      .set('Cookie', cookie);
    expect(single.status).toBe(200);
    expect(single.body.cost).toBe('15.99');
  });
});
