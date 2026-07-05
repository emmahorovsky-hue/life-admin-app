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
  await prisma.deviceToken.upsert({
    where: { token },
    create: { userId, token, platform },
    update: { userId, platform },
  });
}
