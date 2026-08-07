import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { DigestItem, daysUntilLabel } from './emailService';
import { reportServerError } from '../utils/reportError';

// expo-server-sdk v6 is pure ESM ("type": "module") while this server compiles
// to CommonJS. Node 24 (see .nvmrc) supports require() of a synchronous ESM
// graph, so the interop works at runtime — but jest's CJS module registry does
// not, which is why the test setup mocks this module wholesale rather than
// letting it load. Keep the SDK import confined to this file: everything that
// imports pushService stays testable without it.
//
// EXPO_ACCESS_TOKEN is optional. It is only required once "enhanced push
// security" is switched on for the Expo project, and sending works without it
// today — but setting it costs nothing and is what stops a leaked push token
// from letting anyone else notify our users.
const expo = new Expo(
  process.env.EXPO_ACCESS_TOKEN ? { accessToken: process.env.EXPO_ACCESS_TOKEN } : {}
);

// "Netflix", "Netflix and Spotify", "Netflix, Spotify and Figma" — a push body
// has no room for a table, so the names run as prose.
function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// Mirrors the subject/heading logic in sendRenewalReminderDigest so the two
// channels say the same thing in the space each has.
function buildContent(items: DigestItem[]): { title: string; body: string } {
  if (items.length === 1) {
    const item = items[0];
    return {
      title: `${item.name} renews ${daysUntilLabel(item.daysUntil)}`,
      body: `${item.currency} ${item.cost.toFixed(2)}`,
    };
  }
  return {
    title: `${items.length} subscriptions renew soon`,
    body: joinNames(items.map((i) => i.name)),
  };
}

/**
 * Sends one digest push per device token — the push counterpart to
 * `sendRenewalReminderDigest`. One notification per device covering everything
 * due, never one per subscription.
 *
 * Returns the tokens Expo rejected as `DeviceNotRegistered` (app uninstalled,
 * permission revoked) so the caller can delete those rows; a device that no
 * longer exists must not keep a row alive forever.
 *
 * Also returns `delivered`, the number of tokens Expo accepted. A token-level
 * rejection is not a failure of the digest *while other devices got it* — but
 * when none did, the caller must not record the reminder as sent, or dedup will
 * suppress a warning that never left the building. `delivered === 0` with a
 * non-empty `tokens` list is the caller's cue to log `failed`.
 *
 * Throws if a send request fails outright, matching the email path: the caller
 * logs `status: 'failed'` and the per-occurrence dedup lets the next run retry.
 */
export async function sendRenewalPushDigest({
  tokens,
  items,
}: {
  tokens: string[];
  items: DigestItem[];
}): Promise<{ invalidTokens: string[]; delivered: number }> {
  // A malformed row (hand-edited, or a native token that reached the column by
  // mistake) would make Expo reject the whole request, taking the valid devices
  // down with it. Drop it here and treat it as unregistered so it gets cleaned up.
  // Partitioned in a loop rather than with two filters: isExpoPushToken is a type
  // guard, so the negated filter narrows its result to `never`.
  const valid: string[] = [];
  const malformed: string[] = [];
  for (const token of tokens) {
    (Expo.isExpoPushToken(token) ? valid : malformed).push(token);
  }

  if (valid.length === 0) return { invalidTokens: malformed, delivered: 0 };

  const { title, body } = buildContent(items);

  // One message per token rather than one message with `to: [...]`, so tickets
  // come back index-aligned with `valid` and a rejection maps to exactly one row.
  const messages: ExpoPushMessage[] = valid.map((to) => ({
    to,
    title,
    body,
    sound: 'default',
    // Matches the channel mobile/lib/pushNotifications.ts creates at
    // registration time; without it Android drops the notification on 8.0+.
    channelId: 'default',
    // What the mobile response listener routes on — see mobile/lib/notificationRouting.ts.
    data: { type: 'renewal_reminder' },
  }));

  const tickets: ExpoPushTicket[] = [];
  // Chunks are sent sequentially. A throw from a later chunk after an earlier
  // one succeeded means the caller records a failure and retries next run,
  // re-notifying the devices that already got it. That needs >100 devices on a
  // single account to happen at all, which is why it is accepted rather than
  // tracked with partial-progress state.
  for (const chunk of expo.chunkPushNotifications(messages)) {
    tickets.push(...(await expo.sendPushNotificationsAsync(chunk)));
  }

  const invalidTokens = [...malformed];
  let delivered = 0;
  tickets.forEach((ticket, i) => {
    if (ticket.status !== 'error') {
      delivered++;
      return;
    }
    if (ticket.details?.error === 'DeviceNotRegistered') {
      // Prefer the token Expo echoes back; fall back to index alignment.
      invalidTokens.push(ticket.details.expoPushToken ?? valid[i]);
      return;
    }
    // Everything else — MessageTooBig, MessageRateExceeded, and above all
    // InvalidCredentials — is not actionable per-token, but silence here is
    // worse than noise: InvalidCredentials means the project's push credentials
    // are broken and *every* notification is failing, which is otherwise
    // indistinguishable from complete success in both Sentry and the cron log.
    reportServerError(
      `[push] Expo rejected a renewal digest (${ticket.details?.error ?? 'unspecified'})`,
      new Error(ticket.message)
    );
  });

  return { invalidTokens, delivered };
}
