/**
 * Routes that always render light, whatever the user's theme preference is
 * (LIF-186 follow-up). The marketing page and the whole pre-login funnel are
 * designed against the light palette and are the app's first impression, so
 * they opt out of dark mode rather than following `paypr-theme`.
 *
 * `/mobile` is on the list for the opposite-looking reason: it paints its own
 * fixed dark surface from literal colours rather than the tokens, so the one
 * token it does use (`--brand-orange`) must resolve to the light-palette
 * #E53D00 the design was drawn against, not dark mode's lighter variant.
 *
 * This only suppresses the `dark` class on <html> — the stored preference is
 * left untouched, so Settings → Appearance keeps showing the real choice and
 * the app routes pick it straight back up.
 *
 * Mirrored by the pre-paint FOUC guard in index.html — keep the two in sync.
 */
export const LIGHT_ONLY_PATHS = [
  '/',
  '/mobile',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/terms',
  '/privacy',
  '/support',
] as const;

/**
 * `/privacy` is the public policy page; `/settings/privacy` is in-app and stays
 * themed, so prefixes have to match on a segment boundary rather than a bare
 * `startsWith`.
 */
export function isLightOnlyPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return LIGHT_ONLY_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}
