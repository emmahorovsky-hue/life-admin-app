import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { CartesianChart, Bar } from 'victory-native';
import { matchFont } from '@shopify/react-native-skia';
import {
  CategorySpendGroup,
  CurrencyAmount,
  DashboardSummary,
  categorySpendByCurrency,
  dominantCurrency,
  DEFAULT_CURRENCY,
  formatCurrency,
  formatCurrencyTotals,
  renewalTotals,
  spendTotals,
} from '@life-admin/shared';
import { dashboardApi } from '../../lib/dashboard';
import { subscriptionApi } from '../../lib/subscriptions';
import { SubscriptionLogo } from '../../components/SubscriptionLogo';
import { Perforation } from '../../components/Perforation';
import { useAuth } from '../../contexts/AuthContext';
import { colors, fontMono, fontMonoBold } from '../../lib/theme';

const chartFont = matchFont({
  fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }),
  fontSize: 10,
});

// Aggregate figures are lists, not scalars: with no exchange-rate source, costs
// in different currencies can't be added together, so we render one line per
// currency (LIF-107). A single-currency user — the common case — sees exactly
// one line, unchanged from before.
function TotalLines({
  totals,
  fallbackCurrency,
  style,
}: {
  totals: CurrencyAmount[];
  fallbackCurrency: string;
  style: StyleProp<TextStyle>;
}) {
  const lines = formatCurrencyTotals(totals, fallbackCurrency);
  return (
    <>
      {lines.map((line) => (
        <Text key={line} style={lines.length > 1 ? [style, styles.totalLineMulti] : style}>
          {line}
        </Text>
      ))}
    </>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryGroups, setCategoryGroups] = useState<CategorySpendGroup[]>([]);
  // Currency the user predominantly uses — it leads every per-currency list —
  // plus a per-id lookup so each renewal can be attributed to its own
  // subscription's currency (the summary payload carries only id + cost).
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
      setCategoryGroups(categorySpendByCurrency(allSubs, primary));
    } catch {
      // Keep whatever is already rendered; the !summary gate below handles
      // the nothing-loaded-yet case.
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch whenever the tab regains focus so edits on other tabs show up.
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

  // Full-screen error only when there's nothing to show — a failed background
  // refetch (tab focus / pull-to-refresh) must not wipe an already-rendered
  // dashboard.
  if (!summary) {
    return (
      <View style={styles.center}>
        <Text style={styles.mutedText}>Failed to load dashboard</Text>
        <Pressable style={styles.primaryButton} onPress={() => { setLoading(true); load(); }}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const dueSoonRenewals = summary.upcomingRenewals.filter(
    (r) => new Date(r.nextRenewalDate).getTime() - Date.now() <= sevenDaysMs,
  );

  // Every aggregate below is per-currency: renewals can be in different
  // currencies, and with no exchange-rate source a single summed figure would
  // silently add e.g. USD + EUR.
  const currencyOf = (id: string) => currencyById.get(id) ?? displayCurrency;
  const spend = spendTotals(summary, displayCurrency);
  const dueSoonTotals = renewalTotals(dueSoonRenewals, currencyOf, displayCurrency);

  const shownRenewals = summary.upcomingRenewals.slice(0, 5);
  const upcomingTotals = renewalTotals(shownRenewals, currencyOf, displayCurrency);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.h1}>
        Welcome back, {user?.name || user?.email?.split('@')[0]}
        <Text style={styles.accent}>.</Text>
      </Text>

      {/* Summary tiles */}
      <View style={[styles.card, styles.featuredCard]}>
        <Text style={[styles.tileLabel, styles.featuredLabel]}>CHARGED THIS MONTH</Text>
        <TotalLines
          totals={spend.monthly}
          fallbackCurrency={displayCurrency}
          style={[styles.tileValue, styles.featuredValue]}
        />
        <Text style={[styles.tileFootnote, styles.featuredLabel]}>
          {summary.activeSubscriptions} active{' '}
          {summary.activeSubscriptions === 1 ? 'subscription' : 'subscriptions'}
        </Text>
      </View>

      <View style={styles.tileRow}>
        <View style={[styles.card, styles.tileHalf]}>
          <Text style={styles.tileLabel}>PER YEAR</Text>
          <TotalLines
            totals={spend.annual}
            fallbackCurrency={displayCurrency}
            style={styles.tileValueSmall}
          />
        </View>
        <View style={[styles.card, styles.tileHalf]}>
          <Text style={styles.tileLabel}>DUE IN 7 DAYS</Text>
          <TotalLines
            totals={dueSoonTotals}
            fallbackCurrency={displayCurrency}
            style={styles.tileValueSmall}
          />
          {dueSoonRenewals.length > 0 && (
            <Text style={styles.tileFootnote}>
              {dueSoonRenewals.length} {dueSoonRenewals.length === 1 ? 'renewal' : 'renewals'} upcoming
            </Text>
          )}
        </View>
      </View>

      {/* Upcoming renewals — receipt style */}
      <View style={styles.card}>
        {summary.upcomingRenewals.length === 0 ? (
          <Text style={styles.mutedText}>No renewals in the next 30 days</Text>
        ) : (
          <>
            <View style={styles.receiptHeader}>
              <Text style={styles.receiptHeading}>ITEM · RENEWS</Text>
              {dueSoonRenewals.length > 0 && (
                <View style={styles.dueSoonStamp}>
                  <Text style={styles.dueSoonStampText}>DUE SOON</Text>
                </View>
              )}
              <Text style={styles.receiptHeading}>AMOUNT</Text>
            </View>
            <Perforation style={{ marginBottom: 12 }} />

            {shownRenewals.map((renewal) => (
              <View key={renewal.id} style={styles.renewalRow}>
                <SubscriptionLogo name={renewal.name} category={renewal.category} size={20} />
                <Text style={styles.rowName} numberOfLines={1}>
                  {renewal.name}
                </Text>
                <Text style={styles.rowDate}>{format(new Date(renewal.nextRenewalDate), 'MMM d')}</Text>
                <View style={styles.leader} />
                <Text style={styles.rowAmount}>
                  {formatCurrency(
                    parseFloat(renewal.cost),
                    currencyById.get(renewal.id) ?? displayCurrency,
                  )}
                </Text>
              </View>
            ))}

            <View style={styles.doubleRule} />
            <View style={styles.totalRow}>
              <Text style={styles.receiptHeading}>TOTAL</Text>
              {/* One line per currency — see TotalLines */}
              <View style={styles.totalValues}>
                <TotalLines
                  totals={upcomingTotals}
                  fallbackCurrency={displayCurrency}
                  style={styles.totalValue}
                />
              </View>
            </View>

            {summary.upcomingRenewals.length > 5 && (
              <Pressable
                style={styles.outlineButton}
                onPress={() => router.push('/(app)/subscriptions')}
              >
                <Text style={styles.outlineButtonText}>
                  View all {summary.upcomingRenewals.length} renewals
                </Text>
              </Pressable>
            )}
          </>
        )}
      </View>

      {/* Category breakdown — one chart per currency, since bars in different
          currencies can't share an axis. */}
      <View style={styles.card}>
        {categoryGroups.length === 0 ? (
          <>
            <Text style={styles.cardTitle}>Spending by Category</Text>
            <View style={styles.emptyChart}>
              <Text style={styles.mutedText}>No subscriptions yet</Text>
              <Pressable
                style={styles.primaryButton}
                onPress={() => router.push({ pathname: '/(app)/subscriptions', params: { openAdd: '1' } })}
              >
                <Text style={styles.primaryButtonText}>Add Subscription</Text>
              </Pressable>
            </View>
          </>
        ) : (
          categoryGroups.map((group) => (
            <View key={group.currency}>
              <Text style={styles.cardTitle}>
                {/* Name the currency only when there's more than one chart to tell
                    apart — otherwise the title is as it always was. */}
                Spending by Category
                {categoryGroups.length > 1 ? ` · ${group.currency}` : ''}
              </Text>
              <View style={styles.chartBox}>
                <CartesianChart
                  data={group.data}
                  xKey="name"
                  yKeys={['total']}
                  domainPadding={{ left: 24, right: 24, top: 16 }}
                  axisOptions={{
                    font: chartFont,
                    labelColor: colors.mutedForeground,
                    lineColor: colors.border,
                    // Long category names ("Cloud Storage") collide on a phone width.
                    formatXLabel: (name) => {
                      const label = String(name ?? '');
                      return label.length > 7 ? `${label.slice(0, 6)}…` : label;
                    },
                  }}
                >
                  {({ points, chartBounds }) => (
                    <Bar
                      points={points.total}
                      chartBounds={chartBounds}
                      color={colors.foreground}
                      innerPadding={0.4}
                      roundedCorners={{ topLeft: 2, topRight: 2 }}
                    />
                  )}
                </CartesianChart>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  h1: { fontSize: 26, fontWeight: '800', color: colors.foreground, marginBottom: 4, marginTop: 8 },
  accent: { color: colors.brandOrange },
  mutedText: { color: colors.mutedForeground, fontSize: 14 },

  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.foreground, marginBottom: 12 },

  featuredCard: { backgroundColor: colors.brandOrange, borderColor: colors.brandOrange },
  tileRow: { flexDirection: 'row', gap: 12 },
  tileHalf: { flex: 1 },
  tileLabel: {
    fontFamily: fontMono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.mutedForeground,
    marginBottom: 10,
  },
  featuredLabel: { color: 'rgba(255,255,255,0.8)' },
  tileValue: { fontFamily: fontMonoBold, fontSize: 34, color: colors.foreground },
  featuredValue: { color: colors.white },
  tileValueSmall: { fontFamily: fontMonoBold, fontSize: 22, color: colors.foreground },
  tileFootnote: { fontSize: 12, color: colors.mutedForeground, marginTop: 8 },

  receiptHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  receiptHeading: {
    fontFamily: fontMono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.mutedForeground,
  },
  dueSoonStamp: {
    borderWidth: 1,
    borderColor: colors.brandOrange,
    paddingHorizontal: 6,
    paddingVertical: 2,
    transform: [{ rotate: '-4deg' }],
  },
  dueSoonStampText: { fontFamily: fontMono, fontSize: 9, letterSpacing: 1.4, color: colors.brandOrange },
  renewalRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  rowName: { fontFamily: fontMonoBold, fontSize: 13, color: colors.foreground, flexShrink: 1 },
  rowDate: { fontFamily: fontMono, fontSize: 11, color: colors.mutedForeground },
  leader: { flex: 1, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginHorizontal: 6 },
  rowAmount: { fontFamily: fontMonoBold, fontSize: 13, color: colors.foreground },
  doubleRule: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.foreground,
    height: 4,
    marginTop: 6,
    marginBottom: 10,
  },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  totalValues: { alignItems: 'flex-end' },
  totalValue: { fontFamily: fontMonoBold, fontSize: 22, color: colors.foreground },
  // Several currencies stack vertically, so each line gets a size the tiles can
  // fit; a single-currency total keeps its original size.
  totalLineMulti: { fontSize: 18 },

  chartBox: { height: 250 },
  emptyChart: { alignItems: 'center', paddingVertical: 32, gap: 16 },

  primaryButton: {
    backgroundColor: colors.foreground,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primaryButtonText: { color: colors.background, fontWeight: '600' },
  outlineButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 14,
  },
  outlineButtonText: { color: colors.foreground, fontWeight: '600', fontSize: 13 },
});
