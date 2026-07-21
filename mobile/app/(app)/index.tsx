import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { format } from 'date-fns';
import {
  CurrencyAmount,
  DashboardSummary,
  DEFAULT_CURRENCY,
  dominantCurrency,
  formatCurrency,
  formatCurrencyTotals,
  spendTotals,
} from '@life-admin/shared';
import { dashboardApi } from '../../lib/dashboard';
import { subscriptionApi } from '../../lib/subscriptions';
import { AppText, Button } from '../../components/ui';
import { Sparkline } from '../../components/Sparkline';
import { useAuth } from '../../contexts/AuthContext';
import { colors, fonts } from '../../lib/theme';

// Horizontal screen padding — the sparkline spans the content width.
const SCREEN_PAD = 28;

/** "2026-06" → "Jun" (UTC, matching the server's month keys). */
const monthAbbr = (key: string) => format(new Date(`${key}-01T00:00:00Z`), 'MMM');

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
  const { width } = useWindowDimensions();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Dominant currency leads every per-currency list; the per-id map attributes
  // each renewal to its own subscription's currency.
  const [displayCurrency, setDisplayCurrency] = useState(DEFAULT_CURRENCY);
  const [currencyById, setCurrencyById] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    try {
      const [summaryData, allSubs] = await Promise.all([
        dashboardApi.getSummary(),
        subscriptionApi.getAll(),
      ]);
      setSummary(summaryData);
      const primary = dominantCurrency(allSubs.map((sub) => sub.currency));
      setDisplayCurrency(primary);
      setCurrencyById(new Map(allSubs.map((sub) => [sub.id, sub.currency])));
    } catch {
      // Keep whatever is already rendered; the !summary gate handles first load.
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

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
  // (LIF-212). Months with no spend read 0, so the line stays continuous.
  const history = summary.spendHistory ?? [];
  const trend = history.map((m) => {
    const entry = m.byCurrency.find((c) => c.currency === displayCurrency);
    return entry ? parseFloat(entry.total) : 0;
  });

  const renewalTiming = (days: number, date: string) => {
    if (days <= 0) return 'Renews today';
    if (days <= 7) return `Renews in ${days} ${days === 1 ? 'day' : 'days'}`;
    return `Renews ${format(new Date(date), 'MMM d')}`;
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* 1 — Header */}
      <View style={styles.header}>
        {/* `headline` isn't one of AppText's header variants, so the role is
            explicit — this is still the screen title for VoiceOver. */}
        <AppText variant="headline" accessibilityRole="header" style={styles.headerTitle}>
          Overview
        </AppText>
        <AppText style={styles.monthLabel}>{currentMonth}</AppText>
      </View>

      {/* 2 — Hero spend figure */}
      <View>
        <AppText style={styles.eyebrow}>Spent this month</AppText>
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
            <AppText style={styles.axisLabel}>{monthAbbr(history[0].month)}</AppText>
            <AppText style={styles.axisLabel}>{monthAbbr(history[history.length - 1].month)}</AppText>
          </View>
        </View>
      )}

      {/* 4 — Divider */}
      <View style={styles.divider} />

      {/* 5 — Upcoming renewals */}
      <View>
        <AppText variant="headline" accessibilityRole="header" style={styles.upcomingTitle}>
          Upcoming
        </AppText>
        {shownRenewals.length === 0 ? (
          // With nothing tracked at all this is the whole screen's empty state,
          // so it carries the add CTA the card-free redesign otherwise drops —
          // the dashboard is the landing tab and had no other way in.
          subCount === 0 ? (
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
            const dueSoon = r.daysUntilRenewal <= 7;
            const amount = formatCurrency(
              parseFloat(r.cost),
              currencyById.get(r.id) ?? displayCurrency,
            );
            const timing = renewalTiming(r.daysUntilRenewal, r.nextRenewalDate);
            return (
              <Pressable
                key={r.id}
                style={styles.renewRow}
                accessibilityRole="button"
                // The row reads as three separate scraps of text otherwise; the
                // due-soon dot is decorative and has no text of its own.
                accessibilityLabel={`${r.name}, ${amount}, ${timing}${dueSoon ? ', due soon' : ''}`}
                onPress={() => router.push('/(app)/subscriptions')}
              >
                <View style={dueSoon ? styles.dueDot : styles.dueSpacer} />
                <View style={styles.renewBody}>
                  <AppText style={styles.renewName} numberOfLines={1}>{r.name}</AppText>
                  <AppText style={styles.renewTiming}>{timing}</AppText>
                </View>
                <AppText style={styles.renewAmount}>{amount}</AppText>
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
    </ScrollView>
  );
}

// Dashboard "Quiet" 1b (LIF-211). Several sizes here are design-exact and sit
// off the LIF-210 type ladder by intent (54 hero, 16 row name, 11 eyebrow/axis);
// the screen is deliberately Archivo-only, card-free, and near-monochrome.
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: SCREEN_PAD, paddingTop: SCREEN_PAD, paddingBottom: 40, gap: 34 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  mutedText: { color: colors.mutedForeground },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: colors.foreground },
  monthLabel: { fontFamily: fonts.sans.regular, fontSize: 13, color: colors.softMuted },

  eyebrow: {
    fontFamily: fonts.sans.semibold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.softMuted,
    marginBottom: 12,
  },
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

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },

  upcomingTitle: { color: colors.foreground, marginBottom: 4 },
  emptyRenewals: { fontFamily: fonts.sans.regular, fontSize: 13, color: colors.softMuted, paddingVertical: 15 },
  emptyBlock: { alignItems: 'flex-start', gap: 4 },
  renewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.rowDivider,
  },
  dueDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: colors.brandOrange },
  dueSpacer: { width: 6, height: 6 },
  renewBody: { flex: 1 },
  renewName: { fontFamily: fonts.sans.medium, fontSize: 16, color: colors.foreground },
  renewTiming: { fontFamily: fonts.sans.regular, fontSize: 12, color: colors.softMuted, marginTop: 1 },
  renewAmount: {
    fontFamily: fonts.sans.semibold,
    fontSize: 15,
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  seeAll: { paddingTop: 14 },
  seeAllText: { fontFamily: fonts.sans.medium, fontSize: 13, color: colors.foreground },
});
