import prisma from '../../utils/db';
import { emailFields } from '../../utils/email';
import {
  restoreEmailDisplayForms,
  findInconsistentUsers,
} from '../emailDisplayBackfillService';
import { issueEmailVerificationToken, consumeEmailVerificationToken } from '../emailVerificationService';

// The dots this job restores were destroyed at write time, so it takes the
// address on trust from an operator. Everything below is about bounding what
// that trust can cost: the job may only ever rewrite the *display* column of
// the account the supplied address already identifies.
describe('emailDisplayBackfillService', () => {
  beforeEach(async () => {
    await prisma.emailVerificationToken.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.emailVerificationToken.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  // A user as they exist before the fix: dots eaten, canonical form stored in
  // both columns.
  const seedFlattened = () =>
    prisma.user.create({
      data: { ...emailFields('firstlast@gmail.com'), password: 'hashed' },
    });

  it('restores the dots without moving the identity key', async () => {
    const user = await seedFlattened();

    const { outcomes } = await restoreEmailDisplayForms(['first.last@gmail.com']);

    expect(outcomes).toEqual([
      { status: 'applied', userId: user.id, from: 'firstlast@gmail.com', to: 'first.last@gmail.com' },
    ]);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated!.email).toBe('first.last@gmail.com');
    expect(updated!.emailCanonical).toBe('firstlast@gmail.com'); // byte-identical
  });

  it('is idempotent — a second run reports unchanged and writes nothing', async () => {
    const user = await seedFlattened();
    await restoreEmailDisplayForms(['first.last@gmail.com']);
    const afterFirst = await prisma.user.findUnique({ where: { id: user.id } });

    const { outcomes } = await restoreEmailDisplayForms(['first.last@gmail.com']);

    expect(outcomes).toEqual([
      { status: 'unchanged', userId: user.id, email: 'first.last@gmail.com' },
    ]);
    const afterSecond = await prisma.user.findUnique({ where: { id: user.id } });
    expect(afterSecond!.updatedAt).toEqual(afterFirst!.updatedAt);
  });

  it('reports the planned change under --dry-run without writing', async () => {
    const user = await seedFlattened();

    const { dryRun, outcomes } = await restoreEmailDisplayForms(['first.last@gmail.com'], { dryRun: true });

    expect(dryRun).toBe(true);
    expect(outcomes[0]).toMatchObject({ status: 'applied', to: 'first.last@gmail.com' });

    const untouched = await prisma.user.findUnique({ where: { id: user.id } });
    expect(untouched!.email).toBe('firstlast@gmail.com');
  });

  // The safety property. An address that canonicalizes to something no account
  // holds matches nothing — it cannot fall back to a fuzzy match, create a row,
  // or touch a bystander.
  it('refuses an address that identifies no account, and leaves other rows alone', async () => {
    const bystander = await prisma.user.create({
      data: { ...emailFields('someoneelse@gmail.com'), password: 'hashed' },
    });

    const { outcomes } = await restoreEmailDisplayForms(['first.last@gmail.com']);

    expect(outcomes).toEqual([
      { status: 'skipped', input: 'first.last@gmail.com', reason: 'no_such_account' },
    ]);

    const untouched = await prisma.user.findUnique({ where: { id: bystander.id } });
    expect(untouched!.email).toBe('someoneelse@gmail.com');
    expect(untouched!.emailCanonical).toBe('someoneelse@gmail.com');
    expect(await prisma.user.count()).toBe(1);
  });

  it('skips an address that is not a valid email at all', async () => {
    await seedFlattened();

    const { outcomes } = await restoreEmailDisplayForms(['not-an-email']);

    expect(outcomes).toEqual([
      { status: 'skipped', input: 'not-an-email', reason: 'invalid_address' },
    ]);
  });

  // A display-only edit must not invalidate proof of inbox ownership. If the
  // token guard compared display forms, running this job would silently break
  // every pending verification link for the accounts it touched.
  it('leaves a pending verification token consumable', async () => {
    const user = await seedFlattened();
    const issued: string[] = [];
    const sendVerificationEmail = jest.requireMock('../emailService').sendVerificationEmail as jest.Mock;
    sendVerificationEmail.mockImplementation(({ verifyUrl }: { verifyUrl: string }) => {
      issued.push(new URL(verifyUrl).searchParams.get('token')!);
      return Promise.resolve();
    });

    await issueEmailVerificationToken(user.id, user.email);
    await restoreEmailDisplayForms(['first.last@gmail.com']);

    const result = await consumeEmailVerificationToken(issued[0]);
    expect(result).toEqual({ ok: true, userId: user.id });
  });

  describe('findInconsistentUsers', () => {
    it('returns nothing for a healthy table', async () => {
      await seedFlattened();
      await prisma.user.create({
        data: { ...emailFields('someone@example.com'), password: 'hashed' },
      });

      expect(await findInconsistentUsers()).toEqual([]);
    });

    // Simulates the migration→code deploy window, where the old code could
    // still update `email` alone and leave the identity key behind.
    it('flags a row whose identity key no longer matches its address', async () => {
      const user = await seedFlattened();
      await prisma.$executeRaw`UPDATE "User" SET "email" = 'moved@example.com' WHERE "id" = ${user.id}`;

      const bad = await findInconsistentUsers();

      expect(bad).toEqual([
        {
          id: user.id,
          email: 'moved@example.com',
          emailCanonical: 'firstlast@gmail.com',
          expected: 'moved@example.com',
        },
      ]);
    });
  });
});
