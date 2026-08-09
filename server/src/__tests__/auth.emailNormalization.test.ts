import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from '../routes/auth';
import prisma from '../utils/db';
import * as emailService from '../services/emailService';

const sendPasswordResetEmail = emailService.sendPasswordResetEmail as jest.Mock;
const sendVerificationEmail = emailService.sendVerificationEmail as jest.Mock;

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(cors());
  app.use('/api/auth', authRoutes);
  return app;
};

// An email address does two different jobs, and this suite pins the line
// between them:
//
//   display  (User.email)          the address as typed — dots, +tags and all.
//   identity (User.emailCanonical) normalizeEmail()'s form, what every lookup
//                                  and uniqueness check keys on.
//
// The history here is worth knowing before you change an expectation. The
// original code stored only the canonical form, so `first.last@gmail.com` was
// shown back to its owner as `firstlast@gmail.com`. LIF-80 (0b415d7) "fixed"
// that by turning gmail_remove_dots off, which made the stored dotted string
// the identity key too — and every account registered before it, stored
// dotless, could no longer be found at login. That locked real users out and
// was reverted in 87e886d, which is why the display bug survived so long.
//
// Two columns is what lets both properties hold at once: dots are preserved for
// display, and every spelling of one Gmail inbox still resolves to one account.
describe('Auth email identity vs display', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    await prisma.emailVerificationToken.deleteMany({});
    await prisma.user.deleteMany({});
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.emailVerificationToken.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  const registerDotted = () =>
    request(app).post('/api/auth/register').send({
      email: 'first.last@gmail.com',
      password: 'TestPass123!',
      name: 'Dotted User',
    });

  it('stores and returns the Gmail address as typed, dots intact', async () => {
    const response = await registerDotted();

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('first.last@gmail.com');

    const stored = await prisma.user.findUnique({
      where: { emailCanonical: 'firstlast@gmail.com' },
    });
    expect(stored).not.toBeNull();
    expect(stored!.email).toBe('first.last@gmail.com');
    expect(stored!.emailCanonical).toBe('firstlast@gmail.com');
  });

  // DO NOT WEAKEN THIS TEST. It is the regression guard for 87e886d: the moment
  // login stops resolving every spelling of one Gmail inbox to the same row,
  // accounts stored in a different spelling than their owner types are locked
  // out. That is a production outage, not a test failure.
  it('lets a Gmail user log in with any spelling of the same inbox', async () => {
    await registerDotted();

    const spellings = [
      'firstlast@gmail.com',        // the canonical form
      'fir.st.last@gmail.com',      // dots somewhere else entirely
      'first.last+news@gmail.com',  // a +subaddress
      'firstlast@googlemail.com',   // the other Google domain
      'First.Last@Gmail.com',       // mixed case
      '  first.last@gmail.com  ',   // padded by a mobile keyboard
    ];

    for (const email of spellings) {
      const res = await request(app).post('/api/auth/login').send({
        email,
        password: 'TestPass123!',
      });

      expect([email, res.status]).toEqual([email, 200]);
      // Whatever they typed, they get their own address back — the typed
      // spelling never overwrites the stored one.
      expect(res.body.user.email).toBe('first.last@gmail.com');
    }
  });

  it('blocks a second registration from the same Gmail inbox, however it is spelled', async () => {
    await registerDotted();

    const duplicates = [
      'firstlast@gmail.com',
      'f.i.r.s.t.last@gmail.com',
      'first.last+promo@gmail.com',
      'first.last@googlemail.com',
    ];

    for (const email of duplicates) {
      const res = await request(app).post('/api/auth/register').send({
        email,
        password: 'TestPass123!',
        name: 'Impostor',
      });

      expect([email, res.status]).toEqual([email, 400]);
      expect(res.body.error.code).toBe('EMAIL_EXISTS');
    }

    expect(await prisma.user.count()).toBe(1);
  });

  // Only Gmail (and googlemail) ignore dots. Everywhere else they address a
  // different mailbox, so canonicalizing them away would merge two strangers'
  // accounts — the opposite failure to the one this change fixes.
  it('treats dots as significant on non-Gmail domains', async () => {
    const dotted = await request(app).post('/api/auth/register').send({
      email: 'first.last@example.com',
      password: 'TestPass123!',
    });
    expect(dotted.status).toBe(201);

    const stored = await prisma.user.findUnique({
      where: { emailCanonical: 'first.last@example.com' },
    });
    expect(stored!.email).toBe('first.last@example.com');

    const dotless = await request(app).post('/api/auth/register').send({
      email: 'firstlast@example.com',
      password: 'TestPass123!',
    });
    expect(dotless.status).toBe(201);
    expect(await prisma.user.count()).toBe(2);
  });

  it('keeps a +subaddress on the display form while ignoring it for identity', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'first.last+shopping@gmail.com',
      password: 'TestPass123!',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('first.last+shopping@gmail.com');

    const stored = await prisma.user.findUnique({
      where: { emailCanonical: 'firstlast@gmail.com' },
    });
    expect(stored).not.toBeNull();
  });

  it('lowercases, and otherwise leaves the address alone', async () => {
    const response = await request(app).post('/api/auth/register').send({
      email: 'First.Last@Gmail.com',
      password: 'TestPass123!',
      name: 'Mixed Case User',
    });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('first.last@gmail.com');
  });

  // These two resolve the account the same way login does, and both mail the
  // *display* address — which is the same inbox either way, but the address the
  // user recognises when it lands.
  it('resolves forgot-password and resend-verification from any spelling', async () => {
    await registerDotted();
    jest.clearAllMocks();

    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'firstlast@gmail.com' });
    await new Promise((r) => setTimeout(r, 100)); // fire-and-forget; let it flush

    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmail.mock.calls[0][0].to).toBe('first.last@gmail.com');

    await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: 'fir.st.last+x@googlemail.com' });
    await new Promise((r) => setTimeout(r, 100));

    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(sendVerificationEmail.mock.calls[0][0].to).toBe('first.last@gmail.com');
  });
});
