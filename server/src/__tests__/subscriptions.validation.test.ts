// LIF-31: the API accepted values it should have rejected. Category was free
// text (an enum sat unused two lines away in the same file), no free-text field
// had a length cap, and currency was length-checked but never value-checked.

import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';

import subscriptionRoutes from '../routes/subscriptions';
import prisma from '../utils/db';
import { generateToken } from '../utils/jwt';
import { MAX_NAME_LENGTH, MAX_NOTES_LENGTH } from '../constants/validation';

// Mount the router rather than importing ../index, which calls app.listen() —
// same pattern as the other subscription suites.
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/subscriptions', subscriptionRoutes);
  return app;
};

const valid = {
  name: 'Netflix',
  cost: 15.99,
  currency: 'USD',
  billingCycle: 'monthly',
  renewalDate: '2026-08-01T00:00:00.000Z',
  category: 'streaming',
};

describe('Subscription input validation (LIF-31)', () => {
  let app: express.Application;
  let token: string;
  let userId: string;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: `validation-${Date.now()}@example.com`, password: 'x' },
    });
    userId = user.id;
    token = generateToken({ userId: user.id, email: user.email });
  });

  const post = (body: Record<string, unknown>) =>
    request(app).post('/api/subscriptions').set('Authorization', `Bearer ${token}`).send(body);

  const patch = (id: string, body: Record<string, unknown>) =>
    request(app)
      .patch(`/api/subscriptions/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const createOne = async () => {
    const res = await post(valid);
    expect(res.status).toBe(201);
    return res.body.subscription?.id ?? res.body.id;
  };

  describe('category must be a known id', () => {
    it('rejects an unknown category on create', async () => {
      // The headline bug: this returned 201 and persisted "banana" as a category.
      const res = await post({ ...valid, category: 'banana' });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/Category must be one of/);

      const rows = await prisma.subscription.findMany({ where: { userId } });
      expect(rows).toHaveLength(0);
    });

    it('rejects an unknown category on update', async () => {
      const id = await createOne();
      const res = await patch(id, { category: 'banana' });
      expect(res.status).toBe(400);

      const row = await prisma.subscription.findUnique({ where: { id } });
      expect(row?.category).toBe('streaming');
    });

    it('still accepts every real category id', async () => {
      const res = await post({ ...valid, category: 'productivity' });
      expect(res.status).toBe(201);
    });
  });

  describe('free text has length caps', () => {
    it(`rejects a name over ${MAX_NAME_LENGTH} chars`, async () => {
      const res = await post({ ...valid, name: 'a'.repeat(MAX_NAME_LENGTH + 1) });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/Name must be at most/);
    });

    it(`accepts a name of exactly ${MAX_NAME_LENGTH} chars`, async () => {
      // Boundary: the cap is inclusive, so exactly-at-the-limit must pass.
      const res = await post({ ...valid, name: 'a'.repeat(MAX_NAME_LENGTH) });
      expect(res.status).toBe(201);
    });

    it(`rejects notes over ${MAX_NOTES_LENGTH} chars`, async () => {
      const res = await post({ ...valid, notes: 'n'.repeat(MAX_NOTES_LENGTH + 1) });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/Notes must be at most/);
    });

    it('caps name on update too, not just create', async () => {
      const id = await createOne();
      const res = await patch(id, { name: 'a'.repeat(MAX_NAME_LENGTH + 1) });
      expect(res.status).toBe(400);
    });
  });

  describe('currency is value-checked and normalised', () => {
    it('rejects a well-formed but unsupported code', async () => {
      // "ZZZ" is 3 letters, so the old isLength({min:3,max:3}) waved it through.
      const res = await post({ ...valid, currency: 'ZZZ' });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/Currency must be one of/);
    });

    it('normalises lowercase to uppercase rather than rejecting it', async () => {
      // The sanitizer runs before isIn, so "usd" is accepted AND stored as "USD"
      // — otherwise "usd" and "USD" would be two different currencies in the data.
      const res = await post({ ...valid, currency: 'usd' });
      expect(res.status).toBe(201);

      const row = await prisma.subscription.findFirst({ where: { userId } });
      expect(row?.currency).toBe('USD');
    });

    it('normalises on update as well', async () => {
      const id = await createOne();
      const res = await patch(id, { currency: 'eur' });
      expect(res.status).toBe(200);

      const row = await prisma.subscription.findUnique({ where: { id } });
      expect(row?.currency).toBe('EUR');
    });
  });
});
