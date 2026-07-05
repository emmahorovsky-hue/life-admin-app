import { Prisma } from '@prisma/client';
import prisma from '../utils/db';

export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: string
): Promise<void> {
  // Keyed on `token` (globally unique per device), not [userId, token]: if a
  // different user later logs in on the same device and re-registers, this
  // reassigns ownership rather than erroring or leaving a stale row pointing
  // at the previous account.
  try {
    await prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  } catch (err) {
    // upsert isn't atomic: two concurrent first-time registrations of the same
    // token can race on the unique constraint. The row now exists — claim it.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      await prisma.deviceToken.update({
        where: { token },
        data: { userId, platform },
      });
      return;
    }
    throw err;
  }
}
