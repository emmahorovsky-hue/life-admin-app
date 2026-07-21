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
import { format, subMonths } from 'date-fns';
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

// TODO(LIF-211 follow-up): the dashboard summary exposes no monthly history, so
// the spend trend is placeholder sample data. Wire to a real 6-month series
// (needs a backend endpoint) before this ships.
const SAMPLE_TREND = [72, 80, 66, 91, 77, 84];

/** Split a formatted amount into its head ("$84") and decimal tail (".20"). */
function splitAmount(formatted: string): [head: string, tail: string] {
  const i = formatted.lastIndexOf('.');
  return i === -1 ? [formatted, ''] : [formatted.slice(0, i), formatted.slice(i)];
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
        const [head, tail] = splitAmount(line);
        return (
          <AppText key={line} style={styles.hero} numberOfLines={1}>
            {head}
            <Text style={styles.heroDecimal}>{tail}</Text>
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

  const now = new Date();
  const currentMonth = format(now, 'MMMM');
  const trendStart = format(subMonths(now, SAMPLE_TREND.length - 1), 'MMM');
  const trendEnd = format(now, 'MMM');
  const chartWidth = Math.max(0, width - SCREEN_PAD * 2);

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
        <AppText variant="headline" style={styles.headerTitle}>Overview</AppText>
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

      {/* 3 — Spending trend */}
      <View>
        <Sparkline data={SAMPLE_TREND} width={chartWidth} />
        <View style={styles.axisRow}>
          <AppText style={styles.axisLabel}>{trendStart}</AppText>
          <AppText style={styles.axisLabel}>{trendEnd}</AppText>
        </View>
      </View>

      {/* 4 — Divider */}
      <View style={styles.divider} />

      {/* 5 — Upcoming renewals */}
      <View>
        <AppText variant="headline" style={styles.upcomingTitle}>Upcoming</AppText>
        {shownRenewals.length === 0 ? (
          <AppText style={styles.emptyRenewals}>No renewals in the next 30 days.</AppText>
        ) : (
          shownRenewals.map((r) => {
            const dueSoon = r.daysUntilRenewal <= 7;
            return (
              <Pressable
                key={r.id}
                style={styles.renewRow}
                onPress={() => router.push('/(app)/subscriptions')}
              >
                <View style={dueSoon ? styles.dueDot : styles.dueSpacer} />
                <View style={styles.renewBody}>
                  <AppText style={styles.renewName} numberOfLines={1}>{r.name}</AppText>
                  <AppText style={styles.renewTiming}>
                    {renewalTiming(r.daysUntilRenewal, r.nextRenewalDate)}
                  </AppText>
                </View>
                <AppText style={styles.renewAmount}>
                  {formatCurrency(parseFloat(r.cost), currencyById.get(r.id) ?? displayCurrency)}
                </AppText>
              </Pressable>
            );
          })
        )}
        {hasMore && (
          <Pressable style={styles.seeAll} onPress={() => router.push('/(app)/subscriptions')}>
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
