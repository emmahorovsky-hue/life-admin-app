import { lazy, type ComponentType } from 'react';

// Route chunks are content-hashed, so every deploy renames them. A tab opened
// before the deploy still asks for the old names, and the import fails with
// "Failed to fetch dynamically imported module" (LIF-279). Reloading picks up
// the new index.html and its chunk names, so that is what we do — once.
//
// The guard is a timestamp rather than a flag: a second failure straight after
// the reload is real breakage and has to surface (to the error boundary and
// Sentry) instead of looping, but a deploy later in the same session should
// still get its one silent recovery.
export const CHUNK_RELOAD_KEY = 'paypr.chunkReloadAt';
const RELOAD_WINDOW_MS = 30_000;

/** Reloads the page unless it already did so moments ago. Returns whether it did. */
export function reloadForStaleChunk(now = Date.now()): boolean {
  // Offline, the import failed for a reason a reload can't fix — and the
  // reload would swap the app for the browser's offline page.
  if (!navigator.onLine) return false;
  try {
    const last = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY));
    if (last && now - last < RELOAD_WINDOW_MS) return false;
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
  } catch {
    // Storage can throw (Safari private mode). Without it there's no loop
    // guard, so don't reload at all.
    return false;
  }
  window.location.reload();
  return true;
}

/** `React.lazy` that recovers from a chunk renamed by a deploy. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same bound as React.lazy
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().catch((error: unknown) => {
      // Never settle: Suspense keeps the loading screen up until the reload lands.
      if (reloadForStaleChunk()) return new Promise<never>(() => {});
      throw error;
    }),
  );
}
