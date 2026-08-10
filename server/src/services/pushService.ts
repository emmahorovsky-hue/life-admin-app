// Type-only, so nothing here reaches the compiled output. The SDK is loaded at
// send time instead — see loadExpo below.
import type { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { DigestItem, daysUntilLabel } from './emailService';
import { reportServerError } from '../utils/reportError';

type ExpoSdk = typeof import('expo-server-sdk');

let loaded: Promise<{ ExpoClass: ExpoSdk['Expo']; client: Expo }> | null = null;

/**
 * Loads the SDK on first send rather than at import.
 *
 * expo-server-sdk v6 is pure ESM (`"type": "module"`) while this server compiles
 * to CommonJS, so consuming it means Node's `require()` of a synchronous ESM
 * graph — unflagged only from Node 22.12. Loading it at module scope made that a
 * **boot** requirement: pushService is reachable from the entrypoint via
 * jobs/index.ts, so an older runtime threw ERR_REQUIRE_ESM at startup and the
 * whole API failed to serve, over a channel that might be switched off anyway.
 *
 * Deferring it scopes the blast radius to the feature: a runtime that cannot
 * load the SDK now fails this digest, gets logged and retried, and leaves every
 * other route alone. It also means importing this module no longer drags the SDK
 * into jest's CommonJS registry, so the pure helpers above are unit-testable
 * without mocking the module wholesale.
 *
 * Memoised — one client for the process, not one per digest.
 *
 * EXPO_ACCESS_TOKEN is optional. It is only required once "enhanced push
 * security" is switched on for the Expo project, and sending works without it
 * today — but setting it costs nothing and is what stops a leaked push token
 * from letting anyone else notify our users.
 *
 * Setting it on a running service needs a **restart** — the memoisation above is
 * exactly why. The env var is read inside this function rather than at module
 * load, but `loaded` caches the promise for the process, so the value is
 * captured on the first send and never re-read. A service that has already sent
 * one digest will keep using the client it built then. (This comment used to
 * claim the opposite; on Railway, a plain `railway redeploy` is enough, since
 * env-var changes apply without `--from-source`.)
 *
 * Contrast ENABLE_PUSH_REMINDERS, which really is read per call
 * (renewalReminderService.pushChannelEnabled) and so does take effect live.
 */
function loadExpo(): Promise<{ ExpoClass: ExpoSdk['Expo']; client: Expo }> {
  loaded ??= import('expo-server-sdk').then(({ Expo: ExpoClass }) => ({
    ExpoClass,
    client: new ExpoClass(
      process.env.EXPO_ACCESS_TOKEN ? { accessToken: process.env.EXPO_ACCESS_TOKEN } : {}
    ),
  }));
  return loaded;
}

// A push body has no room for a table, so the names run as prose — and no room
// for an unbounded list either. Past three the body has stopped being readable
// long before it approaches Expo's 4KB payload ceiling, and a digest that trips
// MessageTooBig fails every run forever: the error is not token-level, so
// nothing gets pruned and the failed log never dedups the retry.
const MAX_NAMES_IN_BODY = 3;

// "Netflix", "Netflix and Spotify", "Netflix, Spotify and Figma",
// "Netflix, Spotify, Figma and 2 more".
function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length <= MAX_NAMES_IN_BODY) {
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }
  const shown = names.slice(0, MAX_NAMES_IN_BODY);
  return `${shown.join(', ')} and ${names.length - MAX_NAMES_IN_BODY} more`;
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
  const { ExpoClass, client } = await loadExpo();

  // A malformed row (hand-edited, or a native token that reached the column by
  // mistake) would make Expo reject the whole request, taking the valid devices
  // down with it. Drop it here and treat it as unregistered so it gets cleaned up.
  // Partitioned in a loop rather than with two filters: isExpoPushToken is a type
  // guard, so the negated filter narrows its result to `never`.
  const valid: string[] = [];
  const malformed: string[] = [];
  for (const token of tokens) {
    (ExpoClass.isExpoPushToken(token) ? valid : malformed).push(token);
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
  for (const chunk of client.chunkPushNotifications(messages)) {
    tickets.push(...(await client.sendPushNotificationsAsync(chunk)));
  }

  const invalidTokens = [...malformed];
  const otherErrors: string[] = [];
  let firstMessage = '';
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
    // InvalidCredentials — is not actionable per-token.
    if (!firstMessage) firstMessage = ticket.message;
    otherErrors.push(ticket.details?.error ?? 'unspecified');
  });

  // Reported once per digest rather than once per ticket. One message is sent
  // per device, so a project-wide fault — InvalidCredentials above all — errors
  // *every* ticket, and a per-ticket report multiplies a single incident by the
  // user's device count, on every run of a job that will never stop retrying it.
  // Silence is still worse than noise (broken push credentials are otherwise
  // indistinguishable from complete success in both Sentry and the cron log), so
  // the report stays — just once, with the codes tallied.
  if (otherErrors.length > 0) {
    const tally = [...new Set(otherErrors)]
      .map((code) => `${code} ×${otherErrors.filter((c) => c === code).length}`)
      .join(', ');
    reportServerError(
      `[push] Expo rejected ${otherErrors.length}/${valid.length} renewal digest messages (${tally})`,
      new Error(firstMessage || 'Expo returned an error ticket with no message')
    );
  }

  return { invalidTokens, delivered };
}
