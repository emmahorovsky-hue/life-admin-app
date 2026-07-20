import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
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
import { EmptyState } from '../../components/EmptyState';
import { AppText, Button, Card, ScreenTitle } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { colors, TextVariant } from '../../lib/theme';

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
  variant,
  style,
}: {
  totals: CurrencyAmount[];
  fallbackCurrency: string;
  variant: TextVariant;
  style?: StyleProp<TextStyle>;
}) {
  const lines = formatCurrencyTotals(totals, fallbackCurrency);
  return (
    <>
      {lines.map((line) => (
        <AppText key={line} variant={variant} style={lines.length > 1 ? [style, styles.totalLineMulti] : style}>
          {line}
        </AppText>
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
        <AppText variant="body" style={styles.mutedText}>Failed to load dashboard</AppText>
        <Button title="Retry" onPress={() => { setLoading(true); load(); }} />
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
      <ScreenTitle style={styles.title}>
        Welcome back, {user?.name || user?.email?.split('@')[0]}
      </ScreenTitle>

      {/* Summary tiles */}
      <Card style={styles.featuredCard}>
        <AppText variant="monoLabel" style={[styles.tileLabel, styles.featuredLabel]}>CHARGED THIS MONTH</AppText>
        <TotalLines
          totals={spend.monthly}
          fallbackCurrency={displayCurrency}
          variant="monoStat"
          style={styles.featuredValue}
        />
        <AppText variant="caption" style={[styles.tileFootnote, styles.featuredLabel]}>
          {summary.activeSubscriptions} active{' '}
          {summary.activeSubscriptions === 1 ? 'subscription' : 'subscriptions'}
        </AppText>
      </Card>

      <View style={styles.tileRow}>
        <Card style={styles.tileHalf}>
          <AppText variant="monoLabel" style={styles.tileLabel}>PER YEAR</AppText>
          <TotalLines
            totals={spend.annual}
            fallbackCurrency={displayCurrency}
            variant="monoStatSm"
          />
        </Card>
        <Card style={styles.tileHalf}>
          <AppText variant="monoLabel" style={styles.tileLabel}>DUE IN 7 DAYS</AppText>
          <TotalLines
            totals={dueSoonTotals}
            fallbackCurrency={displayCurrency}
            variant="monoStatSm"
          />
          {dueSoonRenewals.length > 0 && (
            <AppText variant="caption" style={styles.tileFootnote}>
              {dueSoonRenewals.length} {dueSoonRenewals.length === 1 ? 'renewal' : 'renewals'} upcoming
            </AppText>
          )}
        </Card>
      </View>

      {/* Upcoming renewals — receipt style */}
      <Card>
        {summary.upcomingRenewals.length === 0 ? (
          <EmptyState tone="inline" iconName={null} title="No renewals in the next 30 days" />
        ) : (
          <>
            <View style={styles.receiptHeader}>
              <AppText variant="monoLabel" style={styles.receiptHeading}>ITEM · RENEWS</AppText>
              {dueSoonRenewals.length > 0 && (
                <View style={styles.dueSoonStamp}>
                  <AppText variant="monoLabel" style={styles.dueSoonStampText}>DUE SOON</AppText>
                </View>
              )}
              <AppText variant="monoLabel" style={styles.receiptHeading}>AMOUNT</AppText>
            </View>
            <Perforation style={{ marginBottom: 12 }} />

            {shownRenewals.map((renewal) => (
              <View key={renewal.id} style={styles.renewalRow}>
                <SubscriptionLogo name={renewal.name} category={renewal.category} size={20} />
                <AppText variant="monoData" style={styles.rowName} numberOfLines={1}>
                  {renewal.name}
                </AppText>
                <AppText variant="monoMeta" style={styles.rowDate}>{format(new Date(renewal.nextRenewalDate), 'MMM d')}</AppText>
                <View style={styles.leader} />
                <AppText variant="monoData" style={styles.rowAmount}>
                  {formatCurrency(
                    parseFloat(renewal.cost),
                    currencyById.get(renewal.id) ?? displayCurrency,
                  )}
                </AppText>
              </View>
            ))}

            <View style={styles.doubleRule} />
            <View style={styles.totalRow}>
              <AppText variant="monoLabel" style={styles.receiptHeading}>TOTAL</AppText>
              {/* One line per currency — see TotalLines */}
              <View style={styles.totalValues}>
                <TotalLines
                  totals={upcomingTotals}
                  fallbackCurrency={displayCurrency}
                  variant="monoStatSm"
                />
              </View>
            </View>

            {summary.upcomingRenewals.length > 5 && (
              <Button
                title={`View all ${summary.upcomingRenewals.length} renewals`}
                variant="outline"
                style={styles.viewAllButton}
                onPress={() => router.push('/(app)/subscriptions')}
              />
            )}
          </>
        )}
      </Card>

      {/* Category breakdown — one chart per currency, since bars in different
          currencies can't share an axis. */}
      <Card>
        {categoryGroups.length === 0 ? (
          <>
            <AppText variant="headline" style={styles.cardTitle}>Spending by Category</AppText>
            <EmptyState
              tone="inline"
              title="No subscriptions yet"
              description="Add one to see where your money goes."
              action={
                <Button
                  title="Add subscription"
                  onPress={() => router.push({ pathname: '/(app)/subscriptions', params: { openAdd: '1' } })}
                />
              }
            />
          </>
        ) : (
          categoryGroups.map((group) => (
            <View key={group.currency}>
              <AppText variant="headline" style={styles.cardTitle}>
                {/* Name the currency only when there's more than one chart to tell
                    apart — otherwise the title is as it always was. */}
                Spending by Category
                {categoryGroups.length > 1 ? ` · ${group.currency}` : ''}
              </AppText>
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
      </Card>
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
  title: { marginBottom: 4, marginTop: 8 },
  mutedText: { color: colors.mutedForeground },

  cardTitle: { marginBottom: 12 },

  featuredCard: { backgroundColor: colors.brandOrange, borderColor: colors.brandOrange },
  tileRow: { flexDirection: 'row', gap: 12 },
  tileHalf: { flex: 1 },
  tileLabel: { color: colors.mutedForeground, marginBottom: 10 },
  featuredLabel: { color: 'rgba(255,255,255,0.8)' },
  featuredValue: { color: colors.white },
  tileFootnote: { color: colors.mutedForeground, marginTop: 8 },

  receiptHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  receiptHeading: { color: colors.mutedForeground },
  dueSoonStamp: {
    borderWidth: 1,
    borderColor: colors.brandOrange,
    paddingHorizontal: 6,
    paddingVertical: 2,
    transform: [{ rotate: '-4deg' }],
  },
  dueSoonStampText: { color: colors.brandOrange },
  renewalRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  rowName: { color: colors.foreground, flexShrink: 1 },
  rowDate: { color: colors.mutedForeground },
  leader: { flex: 1, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginHorizontal: 6 },
  rowAmount: { color: colors.foreground },
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
  // Several currencies stack vertically, so each line drops to the compact
  // figure size to fit; a single-currency total keeps the monoStatSm size.
  totalLineMulti: { fontSize: 20 },

  chartBox: { height: 250 },

  viewAllButton: { marginTop: 14 },
});
