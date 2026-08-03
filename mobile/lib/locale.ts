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
