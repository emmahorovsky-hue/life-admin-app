import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useMinimizeOnScroll } from 'expo-glass-tabs';
import { useTabBarInset } from '../../lib/useTabBarInset';
import { useFocusEffect, useRouter } from 'expo-router';
import { format } from 'date-fns';
import {
  CurrencyAmount,
  DashboardSummary,
  DEFAULT_CURRENCY,
  DUE_SOON_DAYS,
  Subscription,
  dominantCurrency,
  formatCurrency,
  formatCurrencyTotals,
  spendTotals,
} from '@life-admin/shared';
import { dashboardApi } from '../../lib/dashboard';
import { subscriptionApi } from '../../lib/subscriptions';
import { getApiErrorMessage } from '../../lib/utils';
import {
  SubscriptionSheets,
  SubscriptionSheetsHandle,
} from '../../components/SubscriptionSheets';
import { BiometricOptInSheet } from '../../components/BiometricOptInSheet';
import {
  shouldShowResumeRow,
  shouldShowSetup,
  useSetupState,
} from '../../lib/onboarding';
import { AppText, Button } from '../../components/ui';
import { Sparkline } from '../../components/Sparkline';
import { useAuth } from '../../contexts/AuthContext';
import { colors, fonts } from '../../lib/theme';
// The Dashboard established this language; it now lives in lib/quiet so the
// other tabs share one definition rather than copying the numbers (LIF-213).
// The sparkline spans the content width, hence SCREEN_PAD here too.
import { ROW_PAD_V, SCREEN_PAD, quiet } from '../../lib/quiet';

// "2026-06" → "Jun". Built as a *local* date on purpose: date-fns `format`
// renders in local time, so parsing the key as UTC midnight shifted every label
// back a month for anyone west of Greenwich ("2026-06" → "May" in New York, and
// "2026-01" → "Dec" of the wrong year). The key is a calendar label, not an
// instant, so it should never round-trip through a timezone.
const monthAbbr = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return format(new Date(year, month - 1, 1), 'MMM');
};

// Split a formatted amount into the three parts the hero styles differently:
// head ("$84"), decimals (".20"), and a trailing currency code (" SGD", which
// formatCurrencyTotals appends only when several currencies are on screen).
// Matching `.dd` specifically — not the last "." — keeps the code out of the
// de-emphasized tail: it is the only thing telling a USD line from an SGD one,
// so greying it out would defeat the reason it is there.
const AMOUNT_PARTS = /^(.*)(\.\d{2})(.*)$/;

function splitAmount(formatted: string): [head: string, decimals: string, code: string] {
  const m = AMOUNT_PARTS.exec(formatted);
  return m ? [m[1], m[2], m[3]] : [formatted, '', ''];
}

/** Hero spend figure(s) — 54px, integer ink + decimals de-emphasized. One line
 *  per currency (multi-currency has no exchange rate to collapse into one). */
function HeroAmount({
  totals,
  fallbackCurrency,
}: {
  totals: CurrencyAmount[];
  fallbackCurrency: string;
}) {
  const lines = formatCurrencyTotals(totals, fallbackCurrency);
  return (
    <View>
      {lines.map((line) => {
        const [head, decimals, code] = splitAmount(line);
        return (
          // adjustsFontSizeToFit: amounts carry no thousands separators, so a
          // four-figure multi-currency line ("$1234.56 SGD") overruns the
          // content width at 54px — shrink it rather than ellipsizing money.
          <AppText
            key={line}
            style={styles.hero}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {head}
            <Text style={styles.heroDecimal}>{decimals}</Text>
            {code ? <Text style={styles.heroCode}>{code}</Text> : null}
          </AppText>
        );
      })}
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const onScroll = useMinimizeOnScroll();
  const tabBarInset = useTabBarInset();
  const { width } = useWindowDimensions();
  const sheetRef = useRef<SubscriptionSheetsHandle>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Whether the account holds any subscription at all — the first-run gate.
  // Deliberately the row count rather than `summary.activeSubscriptions`, which
  // excludes cancelled and ended rows: someone who cancelled everything still
  // has a file and must not be re-offered setup (web shipped this wrong and
  // corrected it in aa96da0).
  const [hasSubscriptions, setHasSubscriptions] = useState(false);
  // Dominant currency leads every per-currency list; the per-id map attributes
  // each renewal to its own subscription's currency.
  const [displayCurrency, setDisplayCurrency] = useState(DEFAULT_CURRENCY);
  const [currencyById, setCurrencyById] = useState<Map<string, string>>(new Map());
  // The full subscription for each id, kept from the same getAll() the currency
  // map is built from — the dashboard's upcomingRenewals payload is trimmed, so
  // tapping a row needs the whole record to open the detail/edit sheets.
  const [subsById, setSubsById] = useState<Map<string, Subscription>>(new Map());
  // First-run setup (LIF-224). `setup` is null until the persisted state reads
  // back; nothing below decides anything on it before then. Keyed by account,
  // not by device — see the note in lib/onboarding.ts (LIF-242).
  const { user } = useAuth();
  const { state: setup, refresh: refreshSetup } = useSetupState(user?.id);

  const load = useCallback(async () => {
    try {
      const [summaryData, allSubs] = await Promise.all([
        dashboardApi.getSummary(),
        subscriptionApi.getAll(),
      ]);
      setSummary(summaryData);
      setHasSubscriptions(allSubs.length > 0);
      const primary = dominantCurrency(allSubs.map((sub) => sub.currency));
      setDisplayCurrency(primary);
      setCurrencyById(new Map(allSubs.map((sub) => [sub.id, sub.currency])));
      setSubsById(new Map(allSubs.map((sub) => [sub.id, sub])));
    } catch {
      // Keep whatever is already rendered; the !summary gate handles first load.
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      // The setup screen writes its own outcome and pops back here, so the copy
      // held above is stale the moment it returns — re-read it or the resume row
      // never appears after a skip.
      void refreshSetup();
    }, [load, refreshSetup]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Offer setup once per mount, after both halves of the gate have resolved.
  // It is a screen of its own now (app/setup.tsx), so this hands off entirely:
  // the flow persists its own outcome and this screen re-reads it on focus.
  const setupOffered = useRef(false);
  useEffect(() => {
    if (loading || !summary || !setup || setupOffered.current) return;
    if (!shouldShowSetup(setup, hasSubscriptions)) return;
    setupOffered.current = true;
    router.push('/setup');
  }, [loading, summary, setup, hasSubscriptions, router]);

  const resumeSetup = useCallback(() => {
    // Claim the one offer this mount gets, so returning here cannot bounce
    // straight back into the flow the user has just left.
    setupOffered.current = true;
    router.push('/setup');
  }, [router]);

  // Open the detail sheet for a tapped renewal. The full record is usually
  // already in subsById (loaded alongside the summary); fetch by id only as a
  // fallback if it isn't — e.g. a renewal that arrived after the last load.
  const openRenewal = useCallback(
    async (id: string) => {
      const existing = subsById.get(id);
      if (existing) {
        sheetRef.current?.openDetail(existing);
        return;
      }
      try {
        const full = await subscriptionApi.getById(id);
        sheetRef.current?.openDetail(full);
      } catch (err) {
        Alert.alert('Error', getApiErrorMessage(err, 'Failed to open subscription'));
      }
    },
    [subsById],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brandOrange} />
      </View>
    );
  }

  if (!summary) {
    return (
      <View style={styles.center}>
        <AppText variant="body" style={styles.mutedText}>Failed to load dashboard</AppText>
        <Button title="Retry" onPress={() => { setLoading(true); load(); }} />
      </View>
    );
  }

  const spend = spendTotals(summary, displayCurrency);
  const annualLine = formatCurrencyTotals(spend.annual, displayCurrency).join(' / ');
  const subCount = summary.activeSubscriptions;
  const shownRenewals = summary.upcomingRenewals.slice(0, 5);
  const hasMore = summary.upcomingRenewals.length > shownRenewals.length;

  const currentMonth = format(new Date(), 'MMMM');
  const chartWidth = Math.max(0, width - SCREEN_PAD * 2);

  // Trend = the dominant currency's series from the reconstructed spend history
  // (LIF-212). The server already trims months with no data at all; this trims
  // the leading months with none *in this currency* — otherwise a user whose
  // dominant currency is recent reads the earlier months as $0 spent rather
  // than "not tracked yet". Later gaps stay 0 so the line stays continuous.
  const history = summary.spendHistory ?? [];
  const firstTracked = history.findIndex((m) =>
    m.byCurrency.some((c) => c.currency === displayCurrency),
  );
  const trendMonths = firstTracked === -1 ? [] : history.slice(firstTracked);
  const trend = trendMonths.map((m) => {
    const entry = m.byCurrency.find((c) => c.currency === displayCurrency);
    return entry ? parseFloat(entry.total) : 0;
  });

  const renewalTiming = (days: number, date: string) => {
    if (days <= 0) return 'Renews today';
    if (days <= 7) return `Renews in ${days} ${days === 1 ? 'day' : 'days'}`;
    return `Renews ${format(new Date(date), 'MMM d')}`;
  };

  return (
    <>
    <Animated.ScrollView
      style={quiet.screen}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarInset }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      {/* 1 — Header */}
      <View style={quiet.header}>
        {/* `headline` isn't one of AppText's header variants, so the role is
            explicit — this is still the screen title for VoiceOver. */}
        <AppText variant="headline" accessibilityRole="header" style={quiet.headerTitle}>
          Overview
        </AppText>
        <AppText style={quiet.headerMeta}>{currentMonth}</AppText>
      </View>

      {/* 1b — Resume first-run setup, once it has been skipped (LIF-224).
          Web renders a PaperSheet strip; this screen is card-free, so it is a
          plain row borrowing the due-dot vocabulary — the one thing on the
          dashboard that means "this wants your attention". Below the title
          rather than above it, so the screen still opens on its own heading.
          Not dismissible, and it costs nothing: everything under it works, and
          it disappears on its own the moment a first subscription exists. */}
      {setup && shouldShowResumeRow(setup, hasSubscriptions) && (
        <Pressable
          style={[quiet.row, styles.resumeRow]}
          accessibilityRole="button"
          accessibilityLabel={`Finish setting up your file, step ${setup.step} of 3`}
          onPress={resumeSetup}
        >
          <View style={quiet.dueDot} />
          <View style={quiet.rowBody}>
            <AppText style={quiet.rowName}>Finish setting up your file</AppText>
            <AppText style={quiet.rowMeta}>
              Step {setup.step} of 3 · about a minute
            </AppText>
          </View>
          <AppText style={styles.resumeAction}>Resume</AppText>
        </Pressable>
      )}

      {/* 2 — Hero spend figure */}
      <View>
        <AppText style={[quiet.eyebrow, styles.eyebrowSpacing]}>Spent this month</AppText>
        <HeroAmount totals={spend.monthly} fallbackCurrency={displayCurrency} />
        <AppText style={styles.heroSub}>
          {subCount} {subCount === 1 ? 'subscription' : 'subscriptions'} · {annualLine} per year
        </AppText>
      </View>

      {/* 3 — Spending trend (needs ≥2 months to draw a line) */}
      {trend.length >= 2 && (
        <View>
          <Sparkline data={trend} width={chartWidth} />
          <View style={styles.axisRow}>
            <AppText style={styles.axisLabel}>{monthAbbr(trendMonths[0].month)}</AppText>
            <AppText style={styles.axisLabel}>
              {monthAbbr(trendMonths[trendMonths.length - 1].month)}
            </AppText>
          </View>
        </View>
      )}

      {/* 4 — Divider */}
      <View style={quiet.divider} />

      {/* 5 — Upcoming renewals */}
      <View>
        <AppText variant="headline" accessibilityRole="header" style={styles.upcomingTitle}>
          Upcoming
        </AppText>
        {shownRenewals.length === 0 ? (
          // With nothing tracked at all this is the whole screen's empty state,
          // so it carries the add CTA the card-free redesign otherwise drops —
          // the dashboard is the landing tab and had no other way in. Gated on
          // the row count, not `activeSubscriptions`: someone who cancelled
          // everything has a file, so "Nothing tracked yet" would be a lie.
          !hasSubscriptions ? (
            <View style={styles.emptyBlock}>
              <AppText style={styles.emptyRenewals}>
                Nothing tracked yet. Add a subscription to see it here.
              </AppText>
              <Button
                title="Add subscription"
                onPress={() =>
                  router.push({ pathname: '/(app)/subscriptions', params: { openAdd: '1' } })
                }
              />
            </View>
          ) : (
            <AppText style={styles.emptyRenewals}>No renewals in the next 30 days.</AppText>
          )
        ) : (
          shownRenewals.map((r) => {
            const dueSoon = r.daysUntilRenewal <= DUE_SOON_DAYS;
            const amount = formatCurrency(
              parseFloat(r.cost),
              currencyById.get(r.id) ?? displayCurrency,
            );
            const timing = renewalTiming(r.daysUntilRenewal, r.nextRenewalDate);
            return (
              <Pressable
                key={r.id}
                style={quiet.row}
                accessibilityRole="button"
                // The row reads as three separate scraps of text otherwise; the
                // due-soon dot is decorative and has no text of its own.
                accessibilityLabel={`${r.name}, ${amount}, ${timing}${dueSoon ? ', due soon' : ''}`}
                onPress={() => openRenewal(r.id)}
              >
                <View style={dueSoon ? quiet.dueDot : quiet.dueSpacer} />
                <View style={quiet.rowBody}>
                  <AppText style={quiet.rowName} numberOfLines={1}>{r.name}</AppText>
                  <AppText style={quiet.rowMeta}>{timing}</AppText>
                </View>
                <AppText variant="monoData" style={styles.renewAmount}>{amount}</AppText>
              </Pressable>
            );
          })
        )}
        {hasMore && (
          <Pressable
            style={styles.seeAll}
            accessibilityRole="button"
            accessibilityLabel="See all subscriptions"
            onPress={() => router.push('/(app)/subscriptions')}
          >
            <AppText style={styles.seeAllText}>See all</AppText>
          </Pressable>
        )}
      </View>

      {/* Savings insight (section 6) intentionally omitted until a real
          unused-subscription signal exists server-side — see LIF-211. */}
    </Animated.ScrollView>
    <SubscriptionSheets ref={sheetRef} onSaved={load} />
    {/* Offered from here rather than a layout so it can wait for the same two
        signals first-run setup reads — otherwise this would present over the
        setup screen on a fresh account. Deliberately not `!setupOffered.current`:
        that is a ref, so it would not re-render this. */}
    <BiometricOptInSheet
      canOffer={!loading && !!summary && !!setup && !shouldShowSetup(setup, hasSubscriptions)}
    />
    </>
  );
}

// Dashboard "Quiet" 1b (LIF-211). Several sizes here are design-exact and sit
// off the LIF-210 type ladder by intent (54 hero, 16 row name, 11 eyebrow/axis);
// the screen is card-free and near-monochrome. Mostly Archivo, but renewal
// amounts use Space Mono (the monoData face) to match figures on every other tab.
const styles = StyleSheet.create({
  // paddingBottom is applied dynamically via useTabBarInset to clear the glass tab bar.
  content: { paddingHorizontal: SCREEN_PAD, paddingTop: SCREEN_PAD, gap: 34 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  mutedText: { color: colors.mutedForeground },

  // Sits in the content column's own gap, so it drops the row's bottom rule —
  // a hairline directly above the hero would read as a section divider.
  resumeRow: { borderBottomWidth: 0, paddingVertical: 0 },
  resumeAction: { fontFamily: fonts.sans.medium, fontSize: 13, color: colors.foreground },

  eyebrowSpacing: { marginBottom: 12 },
  hero: {
    fontFamily: fonts.sans.bold,
    fontSize: 54,
    letterSpacing: -2,
    lineHeight: 51,
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  heroDecimal: { color: colors.faint },
  // Ink, not faint: the code disambiguates $ USD from $ SGD. Sized down so it
  // reads as a qualifier rather than competing with the figure.
  heroCode: { fontSize: 22, color: colors.foreground },
  heroSub: {
    fontFamily: fonts.sans.regular,
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 14,
    fontVariant: ['tabular-nums'],
  },

  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  axisLabel: { fontFamily: fonts.sans.regular, fontSize: 11, color: colors.softMuted },

  upcomingTitle: { color: colors.foreground, marginBottom: 4 },
  emptyRenewals: { fontFamily: fonts.sans.regular, fontSize: 13, color: colors.softMuted, paddingVertical: ROW_PAD_V },
  emptyBlock: { alignItems: 'flex-start', gap: 4 },
  // Family comes from the monoData variant; only the size is local, matching
  // how Subscriptions and Timeline size their own figures off the same role.
  renewAmount: { fontSize: 15, color: colors.foreground },
  seeAll: { paddingTop: 14 },
  seeAllText: { fontFamily: fonts.sans.medium, fontSize: 13, color: colors.foreground },
});
