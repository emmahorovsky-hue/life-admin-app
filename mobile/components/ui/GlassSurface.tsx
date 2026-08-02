// ─────────────────────────────────────────────────────────────────────────────
// Liquid Glass, gated (LIF-223).
//
// Glass is a refraction of what is behind it, so it only reads where content
// physically passes under a surface. Paypr is near-monochrome off-white — Snow
// #FBFBF9 under white cards — which is why glass here goes on *chrome only*
// (the floating toast, and the read-only sheets) and never on content surfaces.
// `Card`, `Button`, `Input`, `Switch` and `quiet.row` have nothing moving
// behind them: glass there refracts Snow, returns Snow, and costs the hairline
// that currently defines the shape. `AppDialog` is the one place mobile and web
// are deliberately identical, `ExtractionLoadingOverlay` *is* the receipt motif
// glass would dissolve, and `SubscriptionFormSheet` is live text entry, the
// canonical Liquid Glass legibility failure. None of them should use this.
//
// Everything routes through this one wrapper so no call site re-implements the
// availability check or forgets a fallback. The fallbacks are the app's current
// design unchanged, which is what makes Android a genuine no-op and each stage
// independently revertible.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { GlassView, isLiquidGlassAvailable, type GlassStyle } from 'expo-glass-effect';
import { radius } from '@life-admin/shared';
import { colors } from '../../lib/theme';
import { SHEET_RADIUS } from '../../lib/quiet';

export type GlassRole = 'floating' | 'sheet';

// Probed once, at module scope, inside try/catch on purpose:
// `isLiquidGlassAvailable()` calls `requireNativeModule('ExpoGlassEffect')`,
// which *throws* on a binary built before the dependency existed. Uncaught at
// module scope that is a white screen, not a degraded surface — and an OTA can
// land this JS on exactly such a binary.
const LIQUID_GLASS_AVAILABLE: boolean = (() => {
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
})();

/**
 * Whether glass should actually render right now.
 *
 * Reduce Transparency is a *separate* gate: `isLiquidGlassAvailable()` returns
 * true with it enabled, so without this check those users get flat, borderless,
 * shadowless panels — worse than either branch.
 */
export function useGlassEnabled(): boolean {
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    if (!LIQUID_GLASS_AVAILABLE) return;

    let active = true;
    AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
      if (active) setReduceTransparency(enabled);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );

    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return LIQUID_GLASS_AVAILABLE && !reduceTransparency;
}

// Tints mirror the tab bar's theme in app/(app)/_layout.tsx so top and bottom
// chrome cannot drift apart.
const ROLE_GLASS: Record<GlassRole, { tintColor: string; glassEffectStyle: GlassStyle }> = {
  floating: { tintColor: 'rgba(255,255,255,0.55)', glassEffectStyle: 'regular' },
  sheet: { tintColor: 'rgba(251,251,249,0.62)', glassEffectStyle: 'regular' },
};

// Shape applies to both branches — it is geometry, not paint.
const shape = StyleSheet.create({
  floating: { borderRadius: radius.base },
  sheet: { borderRadius: SHEET_RADIUS },
});

// Paint applies only when glass is off. Byte-identical to today's design.
const fallback = StyleSheet.create({
  floating: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.foreground,
    shadowColor: colors.foreground,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  sheet: {
    backgroundColor: colors.background,
  },
});

// `role` shadows ViewProps' ARIA role, which this deliberately does not expose —
// these are decorative chrome surfaces; call sites use `accessibilityRole`.
export interface GlassSurfaceProps extends Omit<ViewProps, 'style' | 'role'> {
  role?: GlassRole;
  /** LAYOUT ONLY. A `backgroundColor` here paints over the effect and kills it
   *  silently — paint belongs in the role recipe or `fallbackStyle`. */
  style?: StyleProp<ViewStyle>;
  /** Applied only when glass is live. */
  glassStyle?: StyleProp<ViewStyle>;
  /** Merged over the role's solid recipe when glass is off. */
  fallbackStyle?: StyleProp<ViewStyle>;
  tintColor?: string;
  glassEffectStyle?: GlassStyle;
  isInteractive?: boolean;
}

/**
 * `backgroundComponent` for a glass bottom sheet.
 *
 * Module-level so the three sheets share one component identity rather than
 * remounting the background on every render. Pair it with
 * `SHEET_BACKDROP_OPACITY` — at gorhom's default 0.5 the glass refracts black
 * and returns opaque grey mush, which is worse contrast than no glass at all.
 */
export function GlassSheetBackground({
  pointerEvents,
  style,
}: {
  pointerEvents?: ViewProps['pointerEvents'];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <GlassSurface
      role="sheet"
      // Both forwarded deliberately: the container passes pointerEvents="none"
      // (the background absolutely fills the sheet and must not intercept
      // touches) and gorhom's own default background carries these a11y props,
      // so replacing it without them silently drops them.
      pointerEvents={pointerEvents}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Bottom Sheet"
      style={style}
    />
  );
}

export function GlassSurface({
  role = 'floating',
  style,
  glassStyle,
  fallbackStyle,
  tintColor,
  glassEffectStyle,
  isInteractive,
  children,
  ...rest
}: GlassSurfaceProps) {
  const glassEnabled = useGlassEnabled();

  if (!glassEnabled) {
    return (
      <View {...rest} style={[shape[role], fallback[role], fallbackStyle, style]}>
        {children}
      </View>
    );
  }

  const recipe = ROLE_GLASS[role];

  return (
    <GlassView
      {...rest}
      // The app is light-locked via `userInterfaceStyle: 'light'`, but the
      // native view reads the *system* trait collection, so 'auto' would render
      // dark glass under ink-on-Snow text on a phone in dark mode.
      colorScheme="light"
      glassEffectStyle={glassEffectStyle ?? recipe.glassEffectStyle}
      tintColor={tintColor ?? recipe.tintColor}
      isInteractive={isInteractive}
      style={[shape[role], glassStyle, style]}
    >
      {children}
    </GlassView>
  );
}
