import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { format, differenceInCalendarDays } from 'date-fns';
import {
  BucketId,
  Subscription,
  bucketFor,
  categories,
  formatCurrency,
  getSubscriptionStatus,
  parseRenewalDate,
  relativeDays,
} from '@life-admin/shared';
import { subscriptionApi } from '../../lib/subscriptions';
import { getApiErrorMessage } from '../../lib/utils';
import { EmptyState } from '../../components/EmptyState';
import { AppText, Button, ScreenTitle } from '../../components/ui';
import { colors, fonts } from '../../lib/theme';
import { SCREEN_PAD, quiet } from '../../lib/quiet';

const BUCKET_LABELS: Record<BucketId, string> = {
  thisWeek: 'This week',
  laterThisMonth: 'Later this month',
  nextMonth: 'Next month',
};

// Same threshold the Dashboard uses for its due-soon dot, so "needs attention"
// means one thing across the app.
const DUE_SOON_DAYS = 7;

const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

export default function TimelineScreen() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      // getAll sorts by the computed next renewal asc — already timeline order.
      const data = await subscriptionApi.getAll({ sort: 'renewalDate', order: 'asc' });
      setSubscriptions(data);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load timeline'));
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

  // Full-screen error only when there's nothing to show — a failed background
  // refetch must not wipe an already-rendered timeline.
  if (error && subscriptions.length === 0) {
    return (
      <View style={styles.center}>
        <AppText variant="body" style={styles.mutedText}>{error}</AppText>
        <Button title="Retry" onPress={() => { setLoading(true); load(); }} />
      </View>
    );
  }

  const today = new Date();

  // Group into buckets, preserving the renewalDate-asc order from the API.
  const buckets: Record<BucketId, Subscription[]> = {
    thisWeek: [],
    laterThisMonth: [],
    nextMonth: [],
  };
  for (const sub of subscriptions) {
    // Cancelled subs won't be charged again — they're not "due", so skip them.
    if (getSubscriptionStatus(sub) !== 'active') continue;
    const bucket = bucketFor(parseRenewalDate(sub.nextRenewalDate), today);
    if (bucket) buckets[bucket].push(sub);
  }

  const sections = (Object.keys(buckets) as BucketId[])
    .filter((id) => buckets[id].length > 0)
    .map((id) => ({ id, title: BUCKET_LABELS[id], data: buckets[id] }));


  return (
    <SectionList
      style={quiet.screen}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(sub) => sub.id}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      // Screen title follows the Settings convention — ScreenTitle's pageTitle
      // role + brand-orange period — rather than the Dashboard's quiet header.
      ListHeaderComponent={<ScreenTitle style={styles.title}>What's due next</ScreenTitle>}
      ListEmptyComponent={
        <EmptyState
          iconName="calendar-outline"
          kicker="All clear"
          title="Nothing due in the next two months"
          description="Renewals will show up here as they approach."
          action={
            <Button
              title="Add a subscription"
              onPress={() => router.push({ pathname: '/(app)/subscriptions', params: { openAdd: '1' } })}
            />
          }
        />
      }
      // Section headers are quiet uppercase eyebrows, matching the Dashboard's
      // "SPENT THIS MONTH". The rotated "DUE SOON" stamp is gone with the rest
      // of the receipt motif (LIF-211 retired it); urgency is now carried by the
      // same orange dot the Dashboard uses, per row.
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeader}>
          <AppText style={quiet.eyebrow}>{section.title}</AppText>
        </View>
      )}
      renderItem={({ item: sub }) => {
        const renewal = parseRenewalDate(sub.nextRenewalDate);
        const days = differenceInCalendarDays(renewal, today);
        const dueSoon = days <= DUE_SOON_DAYS;
        const amount = formatCurrency(parseFloat(sub.cost), sub.currency);
        return (
          <View
            style={quiet.row}
            accessible
            accessibilityLabel={`${sub.name}, ${amount}, ${relativeDays(days)}${dueSoon ? ', due soon' : ''}`}
          >
            <View style={dueSoon ? quiet.dueDot : quiet.dueSpacer} />
            <View style={quiet.rowBody}>
              <AppText style={quiet.rowName} numberOfLines={1}>{sub.name}</AppText>
              <AppText style={quiet.rowMeta}>
                {format(renewal, 'MMM d')} · {categoryLabel(sub.category)}
              </AppText>
            </View>
            <View style={quiet.rowRight}>
              <AppText style={styles.rowRelative}>{relativeDays(days)}</AppText>
              <AppText variant="monoData" style={styles.rowAmount}>{amount}</AppText>
            </View>
          </View>
        );
      }}
    />
  );
}

// Aligned to the Dashboard's Quiet language (LIF-213). This screen is the
// Dashboard's "Upcoming" list expanded into buckets, so its rows deliberately
// take the identical shape — dot, name, meta, amount — rather than carrying the
// logo Subscriptions uses for inventory browsing. The receipt motif (perforated
// section footers, the rotated "DUE SOON" stamp, mono row text) is gone; Space
// Mono is kept only for the amount, the one tabular figure here.
const styles = StyleSheet.create({
  content: { paddingHorizontal: SCREEN_PAD, paddingBottom: 40, flexGrow: 1 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  mutedText: { color: colors.mutedForeground },

  title: { marginTop: SCREEN_PAD, marginBottom: 4 },

  // Generous top space sets each bucket apart now that the perforated rule
  // between sections is gone.
  sectionHeader: { marginTop: 26, marginBottom: 6 },

  rowRelative: { fontFamily: fonts.sans.regular, fontSize: 12, color: colors.softMuted },
  rowAmount: { color: colors.foreground, fontSize: 15, marginTop: 2 },
});
