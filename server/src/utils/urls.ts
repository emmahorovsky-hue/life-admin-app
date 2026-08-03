/**
 * Base URLs for links we hand to users (emails, redirects).
 *
 * Read at call time rather than module load so tests and env changes take
 * effect, and normalized so links survive env vars configured with or without
 * trailing slashes.
 */

/** Web app origin, e.g. `https://paypr.live` — never a trailing slash. */
export function clientUrl(): string {
  return (process.env.CLIENT_URL || 'https://paypr.live').replace(/\/+$/, '');
}

/**
 * Mobile deep-link scheme, e.g. `lifeadmin://` — always a trailing slash.
 *
 * Only for redirect *targets* the app itself opens. Never put this in an
 * email: mail clients can't open a custom scheme, and there are no Universal
 * Links configured to make an https link reach the app (LIF-244).
 */
export function mobileUrl(): string {
  return (process.env.MOBILE_URL || 'lifeadmin://').replace(/([^/])$/, '$1/');
}
