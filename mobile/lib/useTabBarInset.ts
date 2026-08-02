import { useSafeAreaInsets } from 'react-native-safe-area-context';

// The glass tab bar floats above the content (the TabSlot fills the whole screen),
// so scrollable screens must pad their bottom or the last rows hide behind the pill.
// These mirror expo-glass-tabs' own layout constants (glass-tab-bar.tsx):
//   EXPANDED_HEIGHT = 58, and the pill sits max(insets.bottom - 16, 12) above the edge.
// They are copied, not imported — the package exports no layout constants — so
// re-check them against glass-tab-bar.tsx on any expo-glass-tabs upgrade. Toast
// now positions itself off this hook too (LIF-223), and drift here puts the
// toast *behind* the bar rather than above it.
const PILL_HEIGHT = 58;
const PILL_GAP = 24; // breathing room between the last content and the pill

/** Bottom padding a scroll container needs to clear the floating glass tab bar. */
export function useTabBarInset(): number {
  const { bottom } = useSafeAreaInsets();
  return bottom + PILL_HEIGHT + PILL_GAP;
}
