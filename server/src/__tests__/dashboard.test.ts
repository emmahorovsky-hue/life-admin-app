import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';

import dashboardRoutes from '../routes/dashboard';
import { generateToken } from '../utils/jwt';
import prisma from '../utils/db';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/dashboard', dashboardRoutes);
  return app;
};

const authCookie = (userId: string, email: string) =>
  `token=${generateToken({ userId, email })}`;

describe('dashboard renewals (compute-on-read)', () => {
  const app = createTestApp();
  let userId: string;
  let cookie: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: 'dash@example.com', password: 'x', name: 'Dash', emailVerified: true },
    });
    userId = user.id;
    cookie = authCookie(user.id, user.email);
  });

  it('rolls a past monthly anchor forward into upcoming renewals', async () => {
    // Anchor 5 months ago — its next occurrence is within the next 30 days.
    const anchor = new Date();
    anchor.setUTCMonth(anchor.getUTCMonth() - 5);
    anchor.setUTCHours(0, 0, 0, 0);

    await prisma.subscription.create({
      data: {
        userId,
        name: 'Netflix',
        cost: '15.99',
        currency: 'SGD',
        billingCycle: 'monthly',
        renewalDate: anchor,
        category: 'streaming',
      },
    });

    const res = await request(app).get('/api/dashboard/summary').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.upcomingRenewals).toHaveLength(1);
    const renewal = res.body.upcomingRenewals[0];
    // The stale anchor is still returned, but nextRenewalDate is in the future
    // and drives daysUntilRenewal (no longer negative).
    expect(new Date(renewal.nextRenewalDate).getTime()).toBeGreaterThanOrEqual(Date.now() - 86400000);
    expect(renewal.daysUntilRenewal).toBeGreaterThanOrEqual(0);
    expect(renewal.daysUntilRenewal).toBeLessThanOrEqual(30);
  });

  it('excludes subscriptions whose next renewal is beyond 30 days', async () => {
    const anchor = new Date();
    anchor.setUTCDate(anchor.getUTCDate() + 60); // ~2 months out
    anchor.setUTCHours(0, 0, 0, 0);

    await prisma.subscription.create({
      data: {
        userId,
        name: 'Annual Thing',
        cost: '99.00',
        currency: 'SGD',
        billingCycle: 'annual',
        renewalDate: anchor,
        category: 'software',
      },
    });

    const res = await request(app).get('/api/dashboard/summary').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.upcomingRenewals).toHaveLength(0);
  });

  it('/upcoming returns rolled-forward nextRenewalDate alongside the full row', async () => {
    const anchor = new Date();
    anchor.setUTCMonth(anchor.getUTCMonth() - 2);
    anchor.setUTCHours(0, 0, 0, 0);

    await prisma.subscription.create({
      data: {
        userId,
        name: 'Spotify',
        cost: '9.99',
        currency: 'SGD',
        billingCycle: 'monthly',
        renewalDate: anchor,
        category: 'music',
      },
    });

    const res = await request(app).get('/api/dashboard/upcoming').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toHaveProperty('nextRenewalDate');
    expect(res.body[0]).toHaveProperty('isActive', true); // full row preserved
    expect(res.body[0].daysUntilRenewal).toBeGreaterThanOrEqual(0);
  });
});
