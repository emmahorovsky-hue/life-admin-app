// ─────────────────────────────────────────────────────────────────────────────
// SpendPager (LIF-251) — the Dashboard hero, one currency per page.
//
// This project has no exchange-rate source, so per-currency totals can never be
// collapsed into a single figure. The hero used to answer that by stacking them:
// a three-currency account got three 54pt figures in a column, which pushed the
// trend and the whole renewals list off the first screen — and the one
// sparkline underneath tracked only the dominant currency while appearing to
// belong to all of them.
//
// So each currency gets a page of its own — figure, supporting line, and its own
// trend — and the user swipes sideways between them, like the account cards in a
// banking app. Nothing is converted or combined; the pages sit side by side.
//
// A single currency (the overwhelmingly common case) renders as a plain block
// with no scroll view and no dots — byte-for-byte the layout that shipped before
// this existed.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  SharedValue,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AppText } from './ui';
import { Sparkline } from './Sparkline';
import { colors, fonts } from '../lib/theme';

/** One currency's worth of hero. The screen owns the money formatting — it has
 *  the shared currency utils and the no-exchange-rate rule to uphold — so this
 *  component receives display strings and draws them. */
export interface SpendPage {
  /** Currency code. Identity for the page, and read out by VoiceOver. */
  currency: string;
  /** Preformatted spend-this-month figure, e.g. `$84.20`. Unqualified even on a
   *  multi-currency account — `detail` below names the currency. */
  amount: string;
  /** Supporting line under the figure (count + annual total, currency named). */
  detail: string;
  /** Monthly spend in *this* currency, oldest → newest. */
  trend: number[];
  /** First and last month labels for the trend, or null when there is no line
   *  to draw (the sparkline needs two points). */
  axis: [first: string, last: string] | null;
}

// Split a formatted amount into the two parts the hero styles differently:
// head ("$84") and decimals (".20"). Matching `.dd` at the end specifically —
// not the last "." anywhere — so an amount whose currency has no symbol and
// leads with its code ("JPY 500.00") still splits at the right place.
const AMOUNT_PARTS = /^(.*)(\.\d{2})$/;

function splitAmount(formatted: string): [head: string, decimals: string] {
  const m = AMOUNT_PARTS.exec(formatted);
  return m ? [m[1], m[2]] : [formatted, ''];
}

function Page({ page, width }: { page: SpendPage; width: number }) {
  const [head, decimals] = splitAmount(page.amount);
  return (
    <View style={[styles.page, { width }]}>
      <View>
        {/* adjustsFontSizeToFit: amounts carry no thousands separators, so a
            five-figure line overruns the content width at 54px — shrink it
            rather than ellipsizing money. */}
        <AppText
          style={styles.hero}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {head}
          <Text style={styles.heroDecimal}>{decimals}</Text>
        </AppText>
        <AppText style={styles.heroSub}>{page.detail}</AppText>
      </View>

      {/* Trend for this currency only, so the line always belongs to the figure
          above it. Needs ≥2 months to draw. */}
      {page.trend.length >= 2 && page.axis && (
        <View>
          <Sparkline data={page.trend} width={width} />
          <View style={styles.axisRow}>
            <AppText style={styles.axisLabel}>{page.axis[0]}</AppText>
            <AppText style={styles.axisLabel}>{page.axis[1]}</AppText>
          </View>
        </View>
      )}
    </View>
  );
}

/** Position marker for one page. Driven straight off the scroll offset rather
 *  than off a page index in React state, so it tracks the finger continuously
 *  and reverses with it mid-swipe instead of snapping when the gesture ends. */
function Dot({
  index,
  offset,
  pageWidth,
}: {
  index: number;
  offset: SharedValue<number>;
  pageWidth: number;
}) {
  const style = useAnimatedStyle(() => {
    // Distance from this dot's page, in pages: 0 while it is the one on screen,
    // clamped at 1 so dots further away don't keep changing. `pageWidth` is 0
    // for the frame before layout lands, and 0/0 is NaN, not 0 — floor it.
    const away = Math.min(Math.abs(offset.value / Math.max(pageWidth, 1) - index), 1);
    return {
      backgroundColor: interpolateColor(away, [0, 1], [colors.brandOrange, colors.border]),
      transform: [{ scale: 1 - away * 0.15 }],
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

export function SpendPager({ pages, width }: { pages: SpendPage[]; width: number }) {
  const offset = useSharedValue(0);
  // Which page last settled. A ref, not state: nothing renders off it — the dots
  // read the offset directly — it exists only so the tick fires once per page.
  const settled = useRef(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    offset.value = e.contentOffset.x;
  });

  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1));
    if (page === settled.current) return;
    settled.current = page;
    // The same selection tick the setup flow and the form sheet use when a
    // choice changes under the finger — a page landing is that moment here.
    Haptics.selectionAsync().catch(() => {});
  };

  if (pages.length === 0) return null;
  if (pages.length === 1) return <Page page={pages[0]} width={width} />;

  return (
    <View>
      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onMomentumScrollEnd={onSettle}
        scrollEventThrottle={16}
        // Pages are exactly the content column wide, so the pager must be too:
        // `pagingEnabled` snaps by the scroll view's own frame, and any other
        // width lands the pages off the column.
        style={{ width }}
      >
        {pages.map((page, i) => (
          // One accessible element per page: read as three loose scraps of text
          // otherwise, and VoiceOver can't swipe the pager, so the position has
          // to be spoken.
          <View
            key={page.currency}
            accessible
            accessibilityLabel={`${page.currency}, page ${i + 1} of ${pages.length}. Spent this month ${page.amount}. ${page.detail}`}
          >
            <Page page={page} width={width} />
          </View>
        ))}
      </Animated.ScrollView>

      {/* Decorative: every page already announces its own position. */}
      <View style={styles.dots} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {pages.map((page, i) => (
          <Dot key={page.currency} index={i} offset={offset} pageWidth={width} />
        ))}
      </View>
    </View>
  );
}

// Hero typography lifted from the Dashboard's own StyleSheet unchanged (LIF-211
// "Quiet" 1b): the 54pt figure and its 11pt axis labels are design-exact and sit
// off the LIF-210 type ladder by intent.
const styles = StyleSheet.create({
  // The gap the Dashboard's content column used to put between the hero and the
  // trend, now that both live inside one page.
  page: { gap: 34 },

  hero: {
    fontFamily: fonts.sans.bold,
    fontSize: 54,
    letterSpacing: -2,
    lineHeight: 51,
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  heroDecimal: { color: colors.faint },
  heroSub: {
    fontFamily: fonts.sans.regular,
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 14,
    fontVariant: ['tabular-nums'],
  },

  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  axisLabel: { fontFamily: fonts.sans.regular, fontSize: 11, color: colors.softMuted },

  // Left-aligned to the content column rather than centred under the pager:
  // everything else on this screen hangs off the same left edge, and a centred
  // row would be the only thing on it that doesn't.
  dots: { flexDirection: 'row', gap: 6, marginTop: 20 },
  // 6pt squares with a 6pt gap, marked in brand orange when active against
  // `border` when not — exactly the onboarding carousel's pager, so the app has
  // one page-dot vocabulary rather than two. Square like the logo and the
  // due-soon marker; the explicit 0 is not a leftover. The colour is set by the
  // animated style above, which blends between the two as the pager moves; this
  // is only the shape.
  dot: { width: 6, height: 6, borderRadius: 0 },
});
