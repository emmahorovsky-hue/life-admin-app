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

  it('serializes all money as decimal strings (LIF-125)', async () => {
    // Two subs whose monthly total (19.99 + 5.99 = 25.98) is not exactly
    // representable in binary floating point — string totals keep it exact.
    const anchor = new Date();
    anchor.setUTCDate(anchor.getUTCDate() + 3);
    anchor.setUTCHours(0, 0, 0, 0);

    await prisma.subscription.createMany({
      data: [
        {
          userId,
          name: 'Netflix',
          cost: '19.99',
          currency: 'SGD',
          billingCycle: 'monthly',
          renewalDate: anchor,
          category: 'streaming',
        },
        {
          userId,
          name: 'iCloud',
          cost: '5.99',
          currency: 'SGD',
          billingCycle: 'monthly',
          renewalDate: anchor,
          category: 'software',
        },
      ],
    });

    const summary = await request(app).get('/api/dashboard/summary').set('Cookie', cookie);
    expect(summary.status).toBe(200);
    // Totals: decimal strings with 2dp, computed with Decimal arithmetic.
    expect(summary.body.totalMonthlySpend).toBe('25.98');
    expect(summary.body.totalAnnualSpend).toBe('311.76');
    // Per-item cost: same string-decimal contract as the subscription endpoints.
    for (const renewal of summary.body.upcomingRenewals) {
      expect(typeof renewal.cost).toBe('string');
    }
    expect(summary.body.upcomingRenewals.map((r: { cost: string }) => r.cost).sort()).toEqual([
      '19.99',
      '5.99',
    ]);

    // /upcoming and the subscriptions list serialize cost the same way.
    const upcoming = await request(app).get('/api/dashboard/upcoming').set('Cookie', cookie);
    expect(upcoming.status).toBe(200);
    for (const sub of upcoming.body) {
      expect(typeof sub.cost).toBe('string');
    }
  });

  it('reports spend per currency instead of one cross-currency sum (LIF-107)', async () => {
    const anchor = new Date();
    anchor.setUTCDate(anchor.getUTCDate() + 3);
    anchor.setUTCHours(0, 0, 0, 0);

    await prisma.subscription.createMany({
      data: [
        {
          userId,
          name: 'US Thing',
          cost: '10.00',
          currency: 'USD',
          billingCycle: 'monthly',
          renewalDate: anchor,
          category: 'software',
        },
        {
          userId,
          name: 'Another US Thing',
          cost: '120.00',
          currency: 'USD',
          billingCycle: 'annual',
          renewalDate: anchor,
          category: 'streaming',
        },
        {
          userId,
          name: 'EU Thing',
          cost: '10.00',
          currency: 'EUR',
          billingCycle: 'monthly',
          renewalDate: anchor,
          category: 'music',
        },
      ],
    });

    const res = await request(app).get('/api/dashboard/summary').set('Cookie', cookie);

    expect(res.status).toBe(200);
    // USD leads: most subscriptions. Each currency keeps its own totals — they
    // are never added together (no exchange-rate source exists).
    expect(res.body.spendByCurrency).toEqual([
      {
        currency: 'USD',
        totalMonthlySpend: '20.00', // 10.00 + 120.00/12
        totalAnnualSpend: '240.00',
        activeSubscriptions: 2,
      },
      {
        currency: 'EUR',
        totalMonthlySpend: '10.00',
        totalAnnualSpend: '120.00',
        activeSubscriptions: 1,
      },
    ]);
    // The flat totals still add every currency up, and are still sent for
    // already-shipped clients — that's exactly why nothing renders them now.
    expect(res.body.totalMonthlySpend).toBe('30.00');
  });

  // Helpers for the spend-history cases below.
  const monthKey = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const monthsAgoStart = (n: number) => {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, 1));
  };
  type MonthEntry = { month: string; byCurrency: { currency: string; total: string }[] };
  const currencyTotal = (m: MonthEntry, code = 'SGD') =>
    m.byCurrency.find((c) => c.currency === code)?.total ?? null;

  it('reconstructs spend history from createdAt, omitting months with no data (LIF-212)', async () => {
    // Created at the start of the month two months ago: it should count toward
    // that month and every later one. The three months before it have no data
    // at all — the account did not exist — so they are omitted rather than
    // reported as $0, which would render as a spending cliff at signup.
    const future = new Date();
    future.setUTCDate(future.getUTCDate() + 3);

    await prisma.subscription.create({
      data: {
        userId,
        name: 'Netflix',
        cost: '10.00',
        currency: 'SGD',
        billingCycle: 'monthly',
        renewalDate: future,
        category: 'streaming',
        createdAt: monthsAgoStart(2),
      },
    });

    const res = await request(app).get('/api/dashboard/summary').set('Cookie', cookie);
    expect(res.status).toBe(200);

    // 2-ago, 1-ago, current — the three empty leading months are trimmed.
    expect(res.body.spendHistory).toHaveLength(3);
    expect(res.body.spendHistory[0].month).toBe(monthKey(monthsAgoStart(2)));
    expect(res.body.spendHistory[2].month).toBe(monthKey(new Date()));
    // Arrow, not a bare reference: map would pass the index as `code`.
    expect(res.body.spendHistory.map((m: MonthEntry) => currencyTotal(m))).toEqual([
      '10.00',
      '10.00',
      '10.00',
    ]);
  });

  it('ends the history series on the same figure as spend totals when a sub is cancelled (LIF-212)', async () => {
    // Cancelled today: "spent this month" drops it immediately, so the last
    // point of the sparkline has to drop it too — otherwise the two figures on
    // the dashboard disagree. Earlier months keep counting it.
    const future = new Date();
    future.setUTCDate(future.getUTCDate() + 3);

    await prisma.subscription.create({
      data: {
        userId,
        name: 'Spotify',
        cost: '12.00',
        currency: 'SGD',
        billingCycle: 'monthly',
        renewalDate: future,
        category: 'streaming',
        createdAt: monthsAgoStart(3),
        cancelledAt: new Date(),
      },
    });

    const res = await request(app).get('/api/dashboard/summary').set('Cookie', cookie);
    expect(res.status).toBe(200);

    const history = res.body.spendHistory;
    const current = history[history.length - 1];
    expect(current.month).toBe(monthKey(new Date()));

    // Cancelled → out of both the current month's point and the spend total.
    expect(currencyTotal(current)).toBeNull();
    expect(res.body.totalMonthlySpend).toBe('0.00');
    // ...but the months it was actually active still count it.
    expect(currencyTotal(history[0])).toBe('12.00');
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
