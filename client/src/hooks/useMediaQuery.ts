import { useCallback, useSyncExternalStore } from 'react';

/** Reactively track a CSS media query (e.g. `(min-width: 768px)`). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onStoreChange);
      return () => mql.removeEventListener('change', onStoreChange);
    },
    [query]
  );

  return useSyncExternalStore(subscribe, () =>
    typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false
  );
}
