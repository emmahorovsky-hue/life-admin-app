import { Prisma, User } from '@prisma/client';

// Single source of truth for the public user payload every auth path returns
// (register / login / getMe / updateProfile). Mirrors the shared `User` type
// in packages/shared/src/types/user.ts — extend both together (LIF-132).
export const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  surname: true,
  emailVerified: true,
  emailVerifiedAt: true,
  passwordChangedAt: true,
  reminderEmailsEnabled: true,
  reminderPushEnabled: true,
  timezone: true,
  theme: true,
  defaultCurrency: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof PUBLIC_USER_SELECT }>;

// For handlers that already hold a full row (login's credential check reads the
// whole user to compare passwords) — never send that row out directly, it
// carries the password hash.
export function toPublicUser(user: User): PublicUser {
  const publicUser = {} as PublicUser;
  for (const key of Object.keys(PUBLIC_USER_SELECT) as (keyof PublicUser)[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (publicUser as any)[key] = user[key];
  }
  return publicUser;
}
