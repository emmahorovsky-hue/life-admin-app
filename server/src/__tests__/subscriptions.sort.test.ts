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

// One user with three subscriptions whose name, cost, and renewalDate orderings
// all differ, so each sort column produces a distinct sequence.
async function seedUserWithSubscriptions() {
  const user = await prisma.user.create({
    data: {
      email: `sort-${Date.now()}-${Math.random()}@example.com`,
      password: 'hashed',
    },
  });

  const inDays = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
  };

  await prisma.subscription.createMany({
    data: [
      {
        userId: user.id,
        name: 'Bandcamp',
        cost: '30.00',
        currency: 'USD',
        billingCycle: 'monthly',
        renewalDate: inDays(10),
        category: 'music',
      },
      {
        userId: user.id,
        name: 'Adobe',
        cost: '20.00',
        currency: 'USD',
        billingCycle: 'monthly',
        renewalDate: inDays(30),
        category: 'software',
      },
      {
        userId: user.id,
        name: 'Cursor',
        cost: '10.00',
        currency: 'USD',
        billingCycle: 'monthly',
        renewalDate: inDays(20),
        category: 'software',
      },
    ],
  });

  return user;
}

describe('GET /api/subscriptions sort/order validation (LIF-144)', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('invalid params are rejected with 400', () => {
    it('returns 400 (not 500) for an unknown sort column', async () => {
      const user = await seedUserWithSubscriptions();
      const res = await request(app)
        .get('/api/subscriptions?sort=foo')
        .set('Cookie', authCookie(user.id, user.email));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: 'sort' })])
      );
    });

    it('returns 400 for a non-whitelisted (but real) column like userId', async () => {
      const user = await seedUserWithSubscriptions();
      const res = await request(app)
        .get('/api/subscriptions?sort=userId')
        .set('Cookie', authCookie(user.id, user.email));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for an invalid order value', async () => {
      const user = await seedUserWithSubscriptions();
      const res = await request(app)
        .get('/api/subscriptions?sort=name&order=sideways')
        .set('Cookie', authCookie(user.id, user.email));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: 'order' })])
      );
    });

    it('returns 400 when sort is passed multiple times', async () => {
      const user = await seedUserWithSubscriptions();
      const res = await request(app)
        .get('/api/subscriptions?sort=name&sort=cost')
        .set('Cookie', authCookie(user.id, user.email));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('valid combinations still sort correctly', () => {
    it('defaults to nextRenewalDate ascending when no params are given', async () => {
      const user = await seedUserWithSubscriptions();
      const res = await request(app)
        .get('/api/subscriptions')
        .set('Cookie', authCookie(user.id, user.email));

      expect(res.status).toBe(200);
      expect(res.body.map((s: { name: string }) => s.name)).toEqual([
        'Bandcamp',
        'Cursor',
        'Adobe',
      ]);
    });

    it('sorts by name ascending', async () => {
      const user = await seedUserWithSubscriptions();
      const res = await request(app)
        .get('/api/subscriptions?sort=name&order=asc')
        .set('Cookie', authCookie(user.id, user.email));

      expect(res.status).toBe(200);
      expect(res.body.map((s: { name: string }) => s.name)).toEqual([
        'Adobe',
        'Bandcamp',
        'Cursor',
      ]);
    });

    it('sorts by cost descending', async () => {
      const user = await seedUserWithSubscriptions();
      const res = await request(app)
        .get('/api/subscriptions?sort=cost&order=desc')
        .set('Cookie', authCookie(user.id, user.email));

      expect(res.status).toBe(200);
      expect(res.body.map((s: { name: string }) => s.name)).toEqual([
        'Bandcamp',
        'Adobe',
        'Cursor',
      ]);
    });

    it('sorts by renewalDate descending (computed next renewal)', async () => {
      const user = await seedUserWithSubscriptions();
      const res = await request(app)
        .get('/api/subscriptions?sort=renewalDate&order=desc')
        .set('Cookie', authCookie(user.id, user.email));

      expect(res.status).toBe(200);
      expect(res.body.map((s: { name: string }) => s.name)).toEqual([
        'Adobe',
        'Cursor',
        'Bandcamp',
      ]);
    });

    it('accepts sort=createdAt and sort=category', async () => {
      const user = await seedUserWithSubscriptions();
      for (const sort of ['createdAt', 'category']) {
        const res = await request(app)
          .get(`/api/subscriptions?sort=${sort}`)
          .set('Cookie', authCookie(user.id, user.email));
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(3);
      }
    });
  });
});
