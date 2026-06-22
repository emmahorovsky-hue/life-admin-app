import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from '../routes/auth';
import prisma from '../utils/db';

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(cors());
  app.use('/api/auth', authRoutes);
  return app;
};

describe('Auth email normalization', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    await prisma.emailVerificationToken.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.emailVerificationToken.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  // Gmail treats dots as insignificant (a.b@gmail.com and ab@gmail.com are the
  // same inbox), so normalizeEmail() canonicalizes to a single dotless form.
  // Storing the address as typed previously let the same inbox register twice
  // and broke login for accounts created before the as-typed change (LIF-80).
  it('strips dots from Gmail addresses on register (canonical dotless form)', async () => {
    const response = await request(app).post('/api/auth/register').send({
      email: 'first.last@gmail.com',
      password: 'TestPass123!',
      name: 'Dotted User',
    });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('firstlast@gmail.com');

    // The stored email is the dotless canonical form
    const stored = await prisma.user.findUnique({
      where: { email: 'firstlast@gmail.com' },
    });
    expect(stored).not.toBeNull();
    expect(stored!.email).toBe('firstlast@gmail.com');
  });

  it('lets a Gmail user log in with either the dotted or dotless form', async () => {
    // Register with dots...
    await request(app).post('/api/auth/register').send({
      email: 'first.last@gmail.com',
      password: 'TestPass123!',
      name: 'Dotted User',
    });

    // ...log in with the dotless form...
    const dotless = await request(app).post('/api/auth/login').send({
      email: 'firstlast@gmail.com',
      password: 'TestPass123!',
    });
    expect(dotless.status).toBe(200);
    expect(dotless.body.user.email).toBe('firstlast@gmail.com');

    // ...and with a differently-dotted form — both resolve to the same record.
    const dotted = await request(app).post('/api/auth/login').send({
      email: 'fir.st.last@gmail.com',
      password: 'TestPass123!',
    });
    expect(dotted.status).toBe(200);
    expect(dotted.body.user.email).toBe('firstlast@gmail.com');
  });

  it('still lowercases the address on register', async () => {
    const response = await request(app).post('/api/auth/register').send({
      email: 'First.Last@Gmail.com',
      password: 'TestPass123!',
      name: 'Mixed Case User',
    });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('firstlast@gmail.com');
  });
});
