import request from 'supertest';
import bcrypt from 'bcryptjs';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import sharp from 'sharp';
import accountRoutes from '../routes/account';
import prisma from '../utils/db';
import { generateToken } from '../utils/jwt';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(cors());
  app.use('/api/account', accountRoutes);
  return app;
};

// A real, decodable image so sharp processing exercises the full path.
function makePng(width = 800, height = 600): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 229, g: 61, b: 0 } },
  })
    .png()
    .toBuffer();
}

describe('Account Avatar Endpoints', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    await prisma.userAvatar.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.userAvatar.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  async function createUser(email = 'me@example.com') {
    return prisma.user.create({
      data: { email, password: await bcrypt.hash('Password123!', 10), emailVerified: true },
    });
  }

  function authCookie(userId: string, email: string): string {
    return `token=${generateToken({ userId, email })}`;
  }

  describe('POST /api/account/avatar', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/account/avatar')
        .attach('file', await makePng(), 'avatar.png');
      expect(res.status).toBe(401);
    });

    it('stores an uploaded PNG as a 256px WebP and returns the user with avatarUpdatedAt', async () => {
      const user = await createUser();

      const res = await request(app)
        .post('/api/account/avatar')
        .set('Cookie', authCookie(user.id, user.email))
        .attach('file', await makePng(), 'avatar.png');

      expect(res.status).toBe(200);
      expect(res.body.user.avatarUpdatedAt).toEqual(expect.any(String));
      expect(res.body.user.password).toBeUndefined();

      const stored = await prisma.userAvatar.findUnique({ where: { userId: user.id } });
      expect(stored).toBeTruthy();
      expect(stored!.mimeType).toBe('image/webp');
      const meta = await sharp(Buffer.from(stored!.data)).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(256);
      expect(meta.height).toBe(256);
    });

    it('replaces an existing avatar on re-upload', async () => {
      const user = await createUser();
      const cookie = authCookie(user.id, user.email);

      await request(app).post('/api/account/avatar').set('Cookie', cookie).attach('file', await makePng(), 'a.png');
      const first = await prisma.userAvatar.findUnique({ where: { userId: user.id } });

      const res = await request(app)
        .post('/api/account/avatar')
        .set('Cookie', cookie)
        .attach('file', await makePng(300, 300), 'b.png');

      expect(res.status).toBe(200);
      const second = await prisma.userAvatar.findUnique({ where: { userId: user.id } });
      expect(second!.updatedAt.getTime()).toBeGreaterThanOrEqual(first!.updatedAt.getTime());
      expect(await prisma.userAvatar.count()).toBe(1);
    });

    it('rejects a file over 2 MB with FILE_TOO_LARGE', async () => {
      const user = await createUser();
      // Random bytes don't compress, so this reliably exceeds the multer limit.
      const bigBuffer = Buffer.concat([
        (await makePng(64, 64)),
        Buffer.from(Array.from({ length: 2 * 1024 * 1024 }, () => Math.floor(Math.random() * 256))),
      ]);

      const res = await request(app)
        .post('/api/account/avatar')
        .set('Cookie', authCookie(user.id, user.email))
        .attach('file', bigBuffer, 'big.png');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    });

    it('rejects a non-image mime type with UNSUPPORTED_FILE_TYPE', async () => {
      const user = await createUser();

      const res = await request(app)
        .post('/api/account/avatar')
        .set('Cookie', authCookie(user.id, user.email))
        .attach('file', Buffer.from('%PDF-1.4 fake'), { filename: 'doc.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    });

    it('rejects bytes that are not a decodable image with INVALID_IMAGE', async () => {
      const user = await createUser();

      const res = await request(app)
        .post('/api/account/avatar')
        .set('Cookie', authCookie(user.id, user.email))
        .attach('file', Buffer.from('not really a png'), { filename: 'fake.png', contentType: 'image/png' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_IMAGE');
    });
  });

  describe('GET /api/account/avatar', () => {
    it('404s when no avatar is set', async () => {
      const user = await createUser();

      const res = await request(app)
        .get('/api/account/avatar')
        .set('Cookie', authCookie(user.id, user.email));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NO_AVATAR');
    });

    it('serves the stored WebP with an ETag and honors If-None-Match', async () => {
      const user = await createUser();
      const cookie = authCookie(user.id, user.email);
      await request(app).post('/api/account/avatar').set('Cookie', cookie).attach('file', await makePng(), 'a.png');

      const res = await request(app).get('/api/account/avatar').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/webp');
      expect(res.headers.etag).toBeTruthy();
      expect((await sharp(res.body).metadata()).format).toBe('webp');

      const cached = await request(app)
        .get('/api/account/avatar')
        .set('Cookie', cookie)
        .set('If-None-Match', res.headers.etag);
      expect(cached.status).toBe(304);
    });

    it("only ever serves the requester's own avatar", async () => {
      const alice = await createUser('alice@example.com');
      const bob = await createUser('bob@example.com');
      await request(app)
        .post('/api/account/avatar')
        .set('Cookie', authCookie(alice.id, alice.email))
        .attach('file', await makePng(), 'a.png');

      // Bob has no avatar; the route derives identity from the token, so he
      // gets his own 404, never Alice's image.
      const res = await request(app)
        .get('/api/account/avatar')
        .set('Cookie', authCookie(bob.id, bob.email));
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/account/avatar', () => {
    it('removes the avatar and clears avatarUpdatedAt', async () => {
      const user = await createUser();
      const cookie = authCookie(user.id, user.email);
      await request(app).post('/api/account/avatar').set('Cookie', cookie).attach('file', await makePng(), 'a.png');

      const res = await request(app).delete('/api/account/avatar').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.user.avatarUpdatedAt).toBeNull();
      expect(await prisma.userAvatar.count()).toBe(0);
    });

    it('is idempotent when no avatar exists', async () => {
      const user = await createUser();

      const res = await request(app)
        .delete('/api/account/avatar')
        .set('Cookie', authCookie(user.id, user.email));

      expect(res.status).toBe(200);
      expect(res.body.user.avatarUpdatedAt).toBeNull();
    });
  });
});
