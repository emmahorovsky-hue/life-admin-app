import prisma from '../../utils/db';
import { emailFields } from '../../utils/email';
import {
  restoreEmailDisplayForms,
  findInconsistentUsers,
  repairCanonicalKeys,
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

  // The other half of the deploy window: --verify only reports, this fixes.
  // Note the direction — `email` is the truth and `emailCanonical` moves to
  // match it. Every assertion below checks `email` is untouched, because the
  // failure this replaced was a "repair" that rewrote `email` back to the old
  // address and called it success.
  describe('repairCanonicalKeys', () => {
    // A row as the pre-deploy code could leave it: verify-email-change wrote the
    // confirmed new address into `email` alone and left the identity key on the
    // inbox the user no longer has.
    const seedStaleKey = async (from: string, to: string) => {
      const user = await prisma.user.create({
        data: { ...emailFields(from), password: 'hashed' },
      });
      await prisma.$executeRaw`UPDATE "User" SET "email" = ${to} WHERE "id" = ${user.id}`;
      return user;
    };

    it('repoints the identity key at the address the user actually confirmed', async () => {
      const user = await seedStaleKey('firstlast@gmail.com', 'moved@example.com');

      const { outcomes } = await repairCanonicalKeys();

      expect(outcomes).toEqual([
        {
          status: 'repaired',
          userId: user.id,
          email: 'moved@example.com',
          from: 'firstlast@gmail.com',
          to: 'moved@example.com',
        },
      ]);

      const repaired = await prisma.user.findUnique({ where: { id: user.id } });
      expect(repaired!.email).toBe('moved@example.com');
      expect(repaired!.emailCanonical).toBe('moved@example.com');
      // The audit that sent you here now comes back clean.
      expect(await findInconsistentUsers()).toEqual([]);
    });

    it('does nothing at all to a healthy table', async () => {
      const flattened = await seedFlattened();
      const other = await prisma.user.create({
        data: { ...emailFields('someone@example.com'), password: 'hashed' },
      });

      const { outcomes } = await repairCanonicalKeys();

      expect(outcomes).toEqual([]);
      const after = await prisma.user.findMany({ orderBy: { id: 'asc' } });
      expect(after.map((u) => [u.id, u.email, u.emailCanonical, u.updatedAt])).toEqual(
        [flattened, other]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((u) => [u.id, u.email, u.emailCanonical, u.updatedAt]),
      );
    });

    it('reports the planned repair under --dry-run without writing', async () => {
      const user = await seedStaleKey('firstlast@gmail.com', 'moved@example.com');

      const { dryRun, outcomes } = await repairCanonicalKeys({ dryRun: true });

      expect(dryRun).toBe(true);
      expect(outcomes).toEqual([
        {
          status: 'repaired',
          userId: user.id,
          email: 'moved@example.com',
          from: 'firstlast@gmail.com',
          to: 'moved@example.com',
        },
      ]);

      const untouched = await prisma.user.findUnique({ where: { id: user.id } });
      expect(untouched!.emailCanonical).toBe('firstlast@gmail.com');
    });

    // Two accounts for one inbox is a merge decision, not something a job may
    // make. The point of the pre-check is that the operator gets both user ids
    // and an intact database instead of a raw P2002 out of Prisma.
    it('refuses a repair that would collide with another account, without throwing', async () => {
      const holder = await prisma.user.create({
        data: { ...emailFields('taken@gmail.com'), password: 'hashed' },
      });
      // Dots make this a different string in `email` but the same inbox once
      // canonicalized — so the repair target is a key `holder` already owns.
      const conflicted = await seedStaleKey('old@example.com', 'ta.ken@gmail.com');

      const { outcomes } = await repairCanonicalKeys();

      expect(outcomes).toEqual([
        {
          status: 'blocked',
          userId: conflicted.id,
          email: 'ta.ken@gmail.com',
          from: 'old@example.com',
          to: 'taken@gmail.com',
          heldBy: holder.id,
        },
      ]);

      const stillBroken = await prisma.user.findUnique({ where: { id: conflicted.id } });
      expect(stillBroken!.emailCanonical).toBe('old@example.com');
      const bystander = await prisma.user.findUnique({ where: { id: holder.id } });
      expect(bystander!.emailCanonical).toBe('taken@gmail.com');
    });

    // A blocked row must not cost the rows that are fine — an incident is
    // exactly when you want the repairable majority repaired.
    it('repairs the rows it can even when another is blocked', async () => {
      await prisma.user.create({
        data: { ...emailFields('taken@gmail.com'), password: 'hashed' },
      });
      await seedStaleKey('old@example.com', 'ta.ken@gmail.com');
      const repairable = await seedStaleKey('firstlast@gmail.com', 'moved@example.com');

      const { outcomes } = await repairCanonicalKeys();

      expect(outcomes).toHaveLength(2);
      expect(outcomes).toContainEqual(
        expect.objectContaining({ status: 'repaired', userId: repairable.id, to: 'moved@example.com' }),
      );
      expect(outcomes).toContainEqual(expect.objectContaining({ status: 'blocked' }));

      const fixed = await prisma.user.findUnique({ where: { id: repairable.id } });
      expect(fixed!.emailCanonical).toBe('moved@example.com');
    });
  });
});
