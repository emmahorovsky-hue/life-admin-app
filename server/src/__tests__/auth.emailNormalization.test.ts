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

  it('preserves dots in Gmail addresses on register (gmail_remove_dots=false)', async () => {
    const response = await request(app).post('/api/auth/register').send({
      email: 'first.last@gmail.com',
      password: 'TestPass123!',
      name: 'Dotted User',
    });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('first.last@gmail.com');

    // The stored email must keep the dots, not be collapsed to firstlast@gmail.com
    const stored = await prisma.user.findUnique({
      where: { email: 'first.last@gmail.com' },
    });
    expect(stored).not.toBeNull();
    expect(stored!.email).toBe('first.last@gmail.com');
  });

  it('lets a dotted Gmail address register then log in (round-trip)', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'first.last@gmail.com',
      password: 'TestPass123!',
      name: 'Dotted User',
    });

    const login = await request(app).post('/api/auth/login').send({
      email: 'first.last@gmail.com',
      password: 'TestPass123!',
    });

    expect(login.status).toBe(200);
    expect(login.body.user.email).toBe('first.last@gmail.com');
  });

  it('still lowercases the address on register', async () => {
    const response = await request(app).post('/api/auth/register').send({
      email: 'First.Last@Gmail.com',
      password: 'TestPass123!',
      name: 'Mixed Case User',
    });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('first.last@gmail.com');
  });
});
