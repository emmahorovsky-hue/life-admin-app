import { describe, it, expect } from 'vitest';
// `?raw` rather than fs: it resolves relative to this file at transform time,
// so the test does not depend on the working directory the runner was started
// from, and jsdom's non-file `import.meta.url` never enters into it.
import indexHtml from '../../index.html?raw';
import { LIGHT_ONLY_PATHS, isLightOnlyPath } from './themeRoutes';
import { THEME_STORAGE_KEY } from '../contexts/ThemeContext';

// The pre-paint FOUC guard in index.html has to duplicate this module: it runs
// before React mounts, so it cannot import anything. Nothing but these tests
// stops the two copies drifting, and drift is silent — adding a route here and
// forgetting index.html reintroduces exactly the one-frame dark flash the
// light-only list exists to prevent, on hard loads only, where no unit test
// looking at the React tree would ever see it.

/** Pulls the quoted members out of `var lightOnly = [...]` in the guard. */
function guardLightOnlyPaths(): string[] {
  const array = indexHtml.match(/var lightOnly = (\[[^\]]*\])/);
  if (!array) throw new Error('FOUC guard: could not find the `lightOnly` array in index.html');
  return [...array[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
}

describe('themeRoutes', () => {
  describe('isLightOnlyPath', () => {
    it.each(['/', '/login', '/terms', '/support', '/verify-email/success'])('matches %s', (path) => {
      expect(isLightOnlyPath(path)).toBe(true);
    });

    it('ignores a trailing slash', () => {
      expect(isLightOnlyPath('/login/')).toBe(true);
    });

    it('matches on a segment boundary, so /settings/privacy stays themed', () => {
      expect(isLightOnlyPath('/settings/privacy')).toBe(false);
    });

    it('does not match a path that merely starts with the same characters', () => {
      expect(isLightOnlyPath('/registered')).toBe(false);
    });

    it.each(['/dashboard', '/subscriptions', '/settings/appearance'])(
      'leaves %s themed',
      (path) => {
        expect(isLightOnlyPath(path)).toBe(false);
      }
    );
  });

  describe('the FOUC guard in index.html', () => {
    it('lists exactly the same paths, in the same order', () => {
      expect(guardLightOnlyPaths()).toEqual([...LIGHT_ONLY_PATHS]);
    });

    it('reads the same localStorage key as ThemeProvider', () => {
      expect(indexHtml).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`);
    });
  });
});
