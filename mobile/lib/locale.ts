/**
 * The device's locale, as a BCP-47 tag ("en-SG"), or null when it can't be read.
 *
 * `Intl` rather than `expo-localization`: Hermes resolves the tag from the
 * device's own region settings and returns it region-qualified (verified on an
 * iOS 26.3 simulator — "en-SG"), so the native module would buy nothing but a
 * rebuild. If that ever stops holding — a bare "en" here — swap this one
 * function for `Localization.getLocales()[0]` and nothing above it changes.
 *
 * Only ever used to *prefill* a control the user can see and change, so a wrong
 * or missing answer costs a tap, never a silently mis-denominated account.
 */
export function detectLocale(): string | null {
  try {
    return Intl.NumberFormat().resolvedOptions().locale || null;
  } catch {
    return null;
  }
}

/**
 * The device's IANA timezone ("America/Los_Angeles"), or null when it can't be
 * read.
 *
 * Unlike `detectLocale` this is not a prefill — it decides *when the server
 * sends renewal reminders* (LIF-252). The web client has synced this since
 * LIF-11; mobile never did, so an app-only user sat on the `"UTC"` column
 * default and was delivered to at 09:00 UTC, which is 02:00 in California. That
 * is survivable for email and not for push, and push users are precisely the
 * ones who never touch the web client.
 *
 * `Intl` for the same reason as above — Hermes answers this without a native
 * module. A null here is not a fallback to UTC; it means "don't touch what the
 * server already has", which may be a good zone synced from the web.
 */
export function detectTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
