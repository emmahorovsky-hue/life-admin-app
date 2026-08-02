import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Make Android's hardware back button dismiss an open bottom sheet.
 *
 * @gorhom/bottom-sheet ships no BackHandler integration of any kind, so without
 * this back sails past the open sheet and pops the screen *underneath* it — the
 * sheet is left floating over the wrong screen, or torn down mid-request.
 *
 * `ui/FormSheet` calls this for every sheet that renders through it. The two
 * snap-point sheets that cannot (SubscriptionFormSheet, FirstRunSetupSheet)
 * call it directly, which is the whole reason this is a hook and not private to
 * FormSheet: it is the one piece of sheet behaviour those two must not skip.
 *
 * `onBack` always swallows the event while `presented`. A sheet that wants back
 * to do nothing (mid-operation, say) passes a no-op rather than opting out —
 * falling through to the screen below is never the right answer.
 */
export function useSheetBackHandler(presented: boolean, onBack: () => void) {
  useEffect(() => {
    if (Platform.OS !== 'android' || !presented) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [presented, onBack]);
}
