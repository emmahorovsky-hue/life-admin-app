import { useCallback, useEffect, useRef } from 'react';

// setTimeout wrapper whose pending callback is cancelled when the component
// unmounts (or when a new timeout replaces a pending one), so deferred
// callbacks — e.g. the dialogs' success-close timers — can't fire setState
// against an unmounted component.
export function useUnmountSafeTimeout() {
  const idRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(idRef.current), []);

  return useCallback((callback: () => void, delayMs: number) => {
    window.clearTimeout(idRef.current);
    idRef.current = window.setTimeout(callback, delayMs);
  }, []);
}
