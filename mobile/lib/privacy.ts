import { api } from './api';

/**
 * Danger-zone account deletion (LIF-203). The server re-authenticates with the
 * current password and rate-limits to 5 attempts / 15 min; a wrong password
 * comes back as a 400 (INVALID_CURRENT_PASSWORD), so the api interceptor's
 * 401 session-clear never fires for a failed attempt.
 *
 * Lives in its own module rather than an `account.ts` only to avoid a
 * structural conflict with LIF-202, which creates that file in parallel —
 * fold this into `lib/account.ts` once both have merged.
 */
export const deleteAccount = async (data: { password: string }) => {
  return api.delete('/account', { data });
};
