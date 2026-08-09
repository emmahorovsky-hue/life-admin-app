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
// this existed, eyebrow included.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
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
import { SCREEN_PAD, quiet } from '../lib/quiet';

// The eyebrow this hero has always carried. On a multi-currency account each
// page appends its own code ("Spent this month · USD"): the figure below drops
// the trailing code it used to carry, and this is the label the eye is already
// on, so it is the cheapest place to say which currency a page is showing.
const EYEBROW = 'Spent this month';

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

function Page({ page, width, named }: { page: SpendPage; width: number; named: boolean }) {
  const [head, decimals] = splitAmount(page.amount);
  return (
    <View style={[styles.page, { width }]}>
      <View>
        <AppText style={[quiet.eyebrow, styles.eyebrowSpacing]}>
          {named ? `${EYEBROW} · ${page.currency}` : EYEBROW}
        </AppText>
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

/** Position marker for one page, and a way to reach it. The mark is driven
 *  straight off the scroll offset rather than off a page index in React state,
 *  so it tracks the finger continuously and reverses with it mid-swipe instead
 *  of snapping when the gesture ends.
 *
 *  Tappable, like the identical dots on the onboarding carousel: sharing their
 *  look while dropping their affordance would teach one thing and then do
 *  another. It is also the only way to change page without a swipe, which is
 *  what Switch Control and VoiceOver have. */
function Dot({
  index,
  offset,
  interval,
  currency,
  onPress,
}: {
  index: number;
  offset: SharedValue<number>;
  interval: number;
  currency: string;
  onPress: (index: number) => void;
}) {
  const style = useAnimatedStyle(() => {
    // Distance from this dot's page, in pages: 0 while it is the one on screen,
    // clamped at 1 so dots further away don't keep changing. `interval` is 0
    // for the frame before layout lands, and 0/0 is NaN, not 0 — floor it.
    const away = Math.min(Math.abs(offset.value / Math.max(interval, 1) - index), 1);
    return {
      backgroundColor: interpolateColor(away, [0, 1], [colors.brandOrange, colors.border]),
      transform: [{ scale: 1 - away * 0.15 }],
    };
  });
  return (
    <Pressable
      hitSlop={10}
      onPress={() => onPress(index)}
      accessibilityRole="button"
      accessibilityLabel={`Show ${currency} spending`}
    >
      <Animated.View style={[styles.dot, style]} />
    </Pressable>
  );
}

export function SpendPager({ pages, width }: { pages: SpendPage[]; width: number }) {
  // A plain ref, not reanimated's useAnimatedRef: that one exists to be read
  // from a worklet, and its `.current` does not carry ScrollView's imperative
  // methods on the JS side — `scrollTo` silently did nothing through it.
  const scroller = useRef<ScrollView>(null);
  const offset = useSharedValue(0);
  // Which page last settled. A ref, not state: nothing renders off it — the dots
  // read the offset directly — it exists only so the tick fires once per page.
  const settled = useRef(0);

  // The pager runs full-bleed so a swipe started in the screen's own margin is
  // still a swipe: `pagingEnabled` snaps by the scroll view's frame, so the
  // frame has to be the whole screen, and each page carries the content
  // column's padding itself. Anything narrower leaves SCREEN_PAD of dead zone
  // down each edge, which is exactly where a thumb reaches from.
  const interval = width + SCREEN_PAD * 2;

  // Refreshing can change the currencies under a parked pager — delete the only
  // EUR subscription while on the EUR page and the content shrinks beneath the
  // offset. iOS clamps the offset without necessarily emitting a scroll event,
  // so `offset` would keep a value past the last page and *every* dot would
  // read as inactive. Rewind whenever the page list itself changes.
  const identity = pages.map((p) => p.currency).join(',');
  useEffect(() => {
    offset.value = 0;
    settled.current = 0;
    scroller.current?.scrollTo({ x: 0, animated: false });
  }, [identity, offset, scroller]);

  const onScroll = useAnimatedScrollHandler((e) => {
    offset.value = e.contentOffset.x;
  });

  // Momentum end is the reliable signal, but a slow drag released with no
  // velocity doesn't always produce one — hence the drag handler too. Both
  // round to the page they are heading for and both go through `settled`, so
  // the pair can't double-tick a single landing.
  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / Math.max(interval, 1));
    if (page === settled.current) return;
    settled.current = page;
    // The same selection tick the setup flow and the form sheet use when a
    // choice changes under the finger — a page landing is that moment here.
    Haptics.selectionAsync().catch(() => {});
  };

  const goTo = (index: number) => {
    scroller.current?.scrollTo({ x: index * interval, animated: true });
  };

  if (pages.length === 0) return null;
  if (pages.length === 1) return <Page page={pages[0]} width={width} named={false} />;

  return (
    <View>
      <Animated.ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onMomentumScrollEnd={onSettle}
        onScrollEndDrag={onSettle}
        // Every frame, not every 16ms: the handler runs on the UI thread, and
        // 16 caps the dots at 60fps on a 120Hz display — the continuous
        // tracking is the whole reason they read the offset rather than state.
        scrollEventThrottle={1}
        style={[styles.pager, { width: interval }]}
      >
        {pages.map((page, i) => (
          // One accessible element per page: read as four loose scraps of text
          // otherwise, and VoiceOver can't swipe the pager, so the position has
          // to be spoken. The trend is named here too — it is the only thing on
          // the screen with no text equivalent.
          <View
            key={page.currency}
            style={styles.frame}
            accessible
            accessibilityLabel={
              `${page.currency}, page ${i + 1} of ${pages.length}. ${EYEBROW} ${page.amount}. ${page.detail}` +
              (page.axis ? `. Trend from ${page.axis[0]} to ${page.axis[1]}.` : '')
            }
          >
            <Page page={page} width={width} named />
          </View>
        ))}
      </Animated.ScrollView>

      <View style={styles.dots}>
        {pages.map((page, i) => (
          <Dot
            key={page.currency}
            index={i}
            offset={offset}
            interval={interval}
            currency={page.currency}
            onPress={goTo}
          />
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
  eyebrowSpacing: { marginBottom: 12 },

  // Negative margin to escape the screen's horizontal padding — see `interval`.
  // The padding comes back on each frame, so the pages still line up with the
  // column even though the scroll view they sit in spans the display.
  pager: { marginHorizontal: -SCREEN_PAD },
  frame: { paddingHorizontal: SCREEN_PAD },

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
  // one page-dot vocabulary rather than two (and, since it looks the same, one
  // that behaves the same: these are tappable too). Square like the logo and
  // the due-soon marker; the explicit 0 is not a leftover. The colour is set by
  // the animated style above, which blends between the two as the pager moves;
  // this is only the shape.
  dot: { width: 6, height: 6, borderRadius: 0 },
});
