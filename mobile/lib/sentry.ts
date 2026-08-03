// Crash and error reporting, matching the web client (`@sentry/react` in
// client/src/main.tsx) and the API (`@sentry/node` in server/src/instrument.ts).
// Mobile was the one platform with no reporting at all: a crash on a TestFlight
// build showed up as a user saying "it closed", and after an App Store release
// it would not show up at all.
//
// Same three conventions as the other two platforms, deliberately:
//   - nothing initialises without a DSN, so a missing one is a no-op rather
//     than a boot failure;
//   - 20% trace sampling in release, everything in dev;
//   - PII off. This app handles emails and what someone pays for, and Sentry's
//     defaults would attach the user's IP.

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

/**
 * Navigation breadcrumbs and route transactions. Exported because registration
 * is two-part: the integration is constructed here, and `_layout.tsx` hands it
 * the router's container ref once expo-router has one — before that there is no
 * navigation state to subscribe to.
 */
export const navigationIntegration = Sentry.reactNavigationIntegration({
  // Route changes shouldn't hold a transaction open behind an idle screen.
  enableTimeToInitialDisplay: true,
});

/**
 * Read at build time from `app.config.ts` (`extra.sentryDsn`), the same path
 * `apiUrl` and `logoDevToken` take. Nothing in mobile/ sees `process.env` at
 * runtime, so this is the only way the value can arrive.
 */
function dsn(): string | undefined {
  const value = Constants.expoConfig?.extra?.sentryDsn;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function initSentry(): void {
  const value = dsn();
  if (!value) return;

  Sentry.init({
    dsn: value,
    // `release` and `dist` are deliberately not set. The native SDK derives
    // them from the built app (`com.paypr.live@1.0.0+18`), which is the only
    // thing that matches what EAS actually uploaded — a hand-rolled string
    // here would silently stop lining up with the build the moment
    // `autoIncrement` moved the build number without touching `version`.
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    integrations: [navigationIntegration],
    // Matches server/src/instrument.ts. Off by default rather than trusted to
    // scrubbing: the events worth having are stack traces, not identities.
    sendDefaultPii: false,
  });
}
