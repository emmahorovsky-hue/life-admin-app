import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { CartesianChart, Bar } from 'victory-native';
import { matchFont } from '@shopify/react-native-skia';
import {
  DashboardSummary,
  categories,
  dominantCurrency,
  DEFAULT_CURRENCY,
  formatCurrency,
  normalizeToMonthlyCost,
} from '@life-admin/shared';
import { dashboardApi } from '../../lib/dashboard';
import { subscriptionApi } from '../../lib/subscriptions';
import { SubscriptionLogo } from '../../components/SubscriptionLogo';
import { Perforation } from '../../components/Perforation';
import { useAuth } from '../../contexts/AuthContext';
import { colors, fontMono } from '../../lib/theme';

const chartFont = matchFont({
  fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }),
  fontSize: 10,
});

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryData, setCategoryData] = useState<{ name: string; total: number }[]>([]);
  // Currency the user predominantly uses, for aggregate figures, plus a per-id
  // lookup so each renewal row can render in its own subscription's currency.
  const [displayCurrency, setDisplayCurrency] = useState(DEFAULT_CURRENCY);
  const [currencyById, setCurrencyById] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    try {
      const [summaryData, allSubs] = await Promise.all([
        dashboardApi.getSummary(),
        subscriptionApi.getAll(),
      ]);
      setSummary(summaryData);

      setDisplayCurrency(dominantCurrency(allSubs.map((sub) => sub.currency)));
      setCurrencyById(new Map(allSubs.map((sub) => [sub.id, sub.currency])));

      const categoryMap = new Map<string, number>();
      allSubs.forEach((sub) => {
        const monthlyCost = normalizeToMonthlyCost(parseFloat(sub.cost), sub.billingCycle);
        categoryMap.set(sub.category, (categoryMap.get(sub.category) || 0) + monthlyCost);
      });
      setCategoryData(
        Array.from(categoryMap.entries())
          .map(([category, total]) => ({
            name: categories.find((c) => c.id === category)?.name || category,
            total: Math.round(total * 100) / 100,
          }))
          .sort((a, b) => b.total - a.total),
      );
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
  const dueSoonTotal = dueSoonRenewals.reduce((sum, r) => sum + parseFloat(r.cost), 0);

  const shownRenewals = summary.upcomingRenewals.slice(0, 5);
  const renewalTotal = shownRenewals.reduce((sum, r) => sum + parseFloat(r.cost), 0);

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
        <Text style={[styles.tileValue, styles.featuredValue]}>
          {formatCurrency(parseFloat(summary.totalMonthlySpend), displayCurrency)}
        </Text>
        <Text style={[styles.tileFootnote, styles.featuredLabel]}>
          {summary.activeSubscriptions} active{' '}
          {summary.activeSubscriptions === 1 ? 'subscription' : 'subscriptions'}
        </Text>
      </View>

      <View style={styles.tileRow}>
        <View style={[styles.card, styles.tileHalf]}>
          <Text style={styles.tileLabel}>PER YEAR</Text>
          <Text style={styles.tileValueSmall}>
            {formatCurrency(parseFloat(summary.totalAnnualSpend), displayCurrency)}
          </Text>
        </View>
        <View style={[styles.card, styles.tileHalf]}>
          <Text style={styles.tileLabel}>DUE IN 7 DAYS</Text>
          <Text style={styles.tileValueSmall}>{formatCurrency(dueSoonTotal, displayCurrency)}</Text>
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
              <Text style={styles.totalValue}>{formatCurrency(renewalTotal, displayCurrency)}</Text>
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

      {/* Category breakdown chart */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Spending by Category</Text>
        {categoryData.length === 0 ? (
          <View style={styles.emptyChart}>
            <Text style={styles.mutedText}>No subscriptions yet</Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push({ pathname: '/(app)/subscriptions', params: { openAdd: '1' } })}
            >
              <Text style={styles.primaryButtonText}>Add Subscription</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.chartBox}>
            <CartesianChart
              data={categoryData}
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
  tileValue: { fontFamily: fontMono, fontSize: 34, fontWeight: '700', color: colors.foreground },
  featuredValue: { color: colors.white },
  tileValueSmall: { fontFamily: fontMono, fontSize: 22, fontWeight: '700', color: colors.foreground },
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
  rowName: { fontFamily: fontMono, fontWeight: '700', fontSize: 13, color: colors.foreground, flexShrink: 1 },
  rowDate: { fontFamily: fontMono, fontSize: 11, color: colors.mutedForeground },
  leader: { flex: 1, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginHorizontal: 6 },
  rowAmount: { fontFamily: fontMono, fontWeight: '700', fontSize: 13, color: colors.foreground },
  doubleRule: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.foreground,
    height: 4,
    marginTop: 6,
    marginBottom: 10,
  },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  totalValue: { fontFamily: fontMono, fontWeight: '700', fontSize: 22, color: colors.foreground },

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
