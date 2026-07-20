// ─────────────────────────────────────────────────────────────────────────────
// ExtractionLoadingOverlay (mobile) — branded "we're reading your receipt" state.
//
// React Native port of client/src/components/ExtractionLoadingOverlay.tsx, shown
// while subscriptionApi.extract() is in flight (see ReceiptScanChooser). The
// backend call is a single non-streaming Claude request, so there's no real
// per-field progress — the field rows check off on a looping timer purely to make
// the wait feel alive and on-brand. Copy is pulled from @life-admin/shared so web
// and mobile stay in step.
//
// Deliberately a plain absolutely-positioned View, NOT a native `Modal`: a Modal
// fights the @gorhom bottom sheets and leaves gestures dead (LIF-208).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useReducedMotion,
  ZoomIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  APP_NAME,
  EXTRACTION_FIELDS,
  EXTRACTION_FOOTNOTE,
  EXTRACTION_STATUS_LINES,
  EXTRACTION_STATUS_REDUCED,
  radius,
  spacing,
} from '@life-admin/shared';
import { colors, fonts } from '../lib/theme';
import { AppText } from './ui';

// ms each field row stays "pending" before its check lights up (mirrors web).
const STEP_MS = 650;

// Thin variable-width bars for the faux barcode strip, echoing the receipt
// aesthetic. The pattern repeats enough to overflow any card width; the strip
// clips (overflow: 'hidden') so it always spans edge-to-edge.
const BAR_UNIT = [2, 1, 3, 1, 2, 2, 1, 3, 1, 2, 1, 3, 2, 1, 2];
const BARCODE_BARS = Array.from({ length: 8 }, () => BAR_UNIT).flat();

interface Props {
  /** Whether the extraction call is in flight. */
  visible: boolean;
}

/** A single field-reveal row: dashed-circle placeholder → spring-in orange check. */
function FieldRow({ label, checked, reduced }: { label: string; checked: boolean; reduced: boolean }) {
  return (
    <View style={styles.row}>
      {checked ? (
        // Conditionally mounting the filled check means ZoomIn fires each time a
        // row flips to checked — including on every loop of the reveal.
        <Animated.View
          entering={reduced ? undefined : ZoomIn.springify().damping(18).stiffness(500)}
          style={styles.checkFilled}
        >
          <Ionicons name="checkmark" size={13} color={colors.white} />
        </Animated.View>
      ) : (
        <View style={styles.checkPending} />
      )}
      <AppText variant="monoLabel" style={[styles.fieldLabel, checked ? styles.fieldLabelOn : styles.fieldLabelOff]}>
        {label}
      </AppText>
      <View style={[styles.leader, checked && styles.leaderHidden]} />
    </View>
  );
}

export function ExtractionLoadingOverlay({ visible }: Props) {
  const reduced = useReducedMotion();

  // How many field rows are currently "checked". Counts 0..FIELDS.length then
  // loops back to 0 so the reveal keeps cycling for as long as the overlay is up.
  const [revealed, setRevealed] = useState(0);

  // Restart the reveal from zero on the open edge, adjusted during render so a
  // reopened overlay never flashes the previous cycle's checks.
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setRevealed(0);
  }

  useEffect(() => {
    if (!visible || reduced) return;
    const id = setInterval(() => {
      setRevealed((n) => (n >= EXTRACTION_FIELDS.length ? 0 : n + 1));
    }, STEP_MS);
    return () => clearInterval(id);
  }, [visible, reduced]);

  if (!visible) return null;

  // Status line follows the reveal progress through the three phases.
  const statusIndex = Math.min(
    EXTRACTION_STATUS_LINES.length - 1,
    Math.floor((revealed / EXTRACTION_FIELDS.length) * EXTRACTION_STATUS_LINES.length),
  );
  const status = reduced ? EXTRACTION_STATUS_REDUCED : EXTRACTION_STATUS_LINES[statusIndex];

  return (
    <View
      style={styles.overlay}
      pointerEvents="auto"
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel="Extracting subscription details from your receipt"
    >
      <Animated.View
        entering={reduced ? undefined : FadeInDown.duration(350)}
        style={styles.card}
      >
        {/* Brand kicker + cycling status */}
        <AppText variant="monoLabel" style={styles.kicker}>{APP_NAME} · AI</AppText>
        <View style={styles.statusWrap}>
          <Animated.Text
            key={status}
            entering={reduced ? undefined : FadeIn.duration(250)}
            style={styles.status}
          >
            {status}
          </Animated.Text>
        </View>

        <View style={styles.rule} />

        {/* Field-reveal checklist */}
        <View style={styles.fields}>
          {EXTRACTION_FIELDS.map((label, i) => (
            <FieldRow key={label} label={label} checked={reduced || i < revealed} reduced={reduced} />
          ))}
        </View>

        {/* Faux barcode + reassurance. Fixed thin bars that overflow and clip,
            so the strip spans the full card width on any screen size. */}
        <View style={styles.barcode}>
          {BARCODE_BARS.map((w, i) => (
            <View key={i} style={[styles.bar, { width: w }]} />
          ))}
        </View>
        <AppText variant="monoMeta" style={styles.footnote}>{EXTRACTION_FOOTNOTE}</AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    elevation: 100,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.card,
    borderRadius: radius.base,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 28,
    paddingVertical: 32,
    // Warm receipt shadow (foreground is 40,33,20).
    shadowColor: '#282114',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 20 },
    elevation: 12,
  },

  kicker: { letterSpacing: 1.8, color: colors.brandOrange },
  statusWrap: { height: 24, marginTop: 4, justifyContent: 'center', overflow: 'hidden' },
  // Intentional local size: the animated status line is the overlay's focal
  // heading and sits between monoData (13) and monoStatSm (22) — no scale peer.
  status: { fontFamily: fonts.mono.bold, fontSize: 16, color: colors.foreground },

  rule: {
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    marginVertical: spacing.lg,
  },

  fields: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  checkFilled: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.brandOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkPending: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  fieldLabel: { letterSpacing: 1.3 },
  fieldLabelOn: { color: colors.foreground },
  fieldLabelOff: { color: colors.mutedForeground },
  leader: {
    flex: 1,
    alignSelf: 'center',
    borderBottomWidth: 1,
    borderStyle: 'dotted',
    borderColor: colors.border,
  },
  leaderHidden: { borderColor: 'transparent' },

  barcode: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 20,
    marginTop: spacing.xl,
    gap: 2,
    overflow: 'hidden',
  },
  bar: { height: '100%', backgroundColor: colors.foreground, opacity: 0.55 },

  footnote: {
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
