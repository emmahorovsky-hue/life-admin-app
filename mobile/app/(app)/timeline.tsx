import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
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
import { SubscriptionLogo } from '../../components/SubscriptionLogo';
import { Perforation } from '../../components/Perforation';
import { EmptyState } from '../../components/EmptyState';
import { Button, ScreenTitle } from '../../components/ui';
import { colors, fontMono, fontMonoBold, fonts } from '../../lib/theme';

const BUCKET_LABELS: Record<BucketId, string> = {
  thisWeek: 'This Week',
  laterThisMonth: 'Later This Month',
  nextMonth: 'Next Month',
};

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
        <Text style={styles.mutedText}>{error}</Text>
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
      style={styles.screen}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(sub) => sub.id}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
      renderSectionHeader={({ section }) => {
        const isThisWeek = section.id === 'thisWeek';
        return (
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isThisWeek && styles.sectionTitleAccent]}>
              {section.title.toUpperCase()}
            </Text>
            {isThisWeek && (
              <View style={styles.dueSoonStamp}>
                <Text style={styles.dueSoonStampText}>DUE SOON</Text>
              </View>
            )}
          </View>
        );
      }}
      renderSectionFooter={() => <Perforation style={{ marginTop: 10, marginBottom: 14 }} />}
      renderItem={({ item: sub, section }) => {
        const renewal = parseRenewalDate(sub.nextRenewalDate);
        const days = differenceInCalendarDays(renewal, today);
        const isThisWeek = section.id === 'thisWeek';
        return (
          <View style={styles.row}>
            <SubscriptionLogo name={sub.name} category={sub.category} size={20} />
            <View style={styles.rowBody}>
              <Text style={styles.rowName} numberOfLines={1}>
                {sub.name}
              </Text>
              <Text style={styles.rowMeta}>
                {format(renewal, 'MMM d')} · {categoryLabel(sub.category)}
              </Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.rowRelative, isThisWeek && styles.rowRelativeAccent]}>
                {relativeDays(days)}
              </Text>
              <Text style={styles.rowAmount}>
                {formatCurrency(parseFloat(sub.cost), sub.currency)}
              </Text>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  title: { marginBottom: 16, marginTop: 8 },
  mutedText: { fontFamily: fonts.sans.regular, color: colors.mutedForeground, fontSize: 14 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: fontMono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.mutedForeground,
  },
  sectionTitleAccent: { color: colors.brandOrange },
  dueSoonStamp: {
    borderWidth: 1,
    borderColor: colors.brandOrange,
    paddingHorizontal: 6,
    paddingVertical: 2,
    transform: [{ rotate: '-4deg' }],
  },
  dueSoonStampText: { fontFamily: fontMono, fontSize: 9, letterSpacing: 1.4, color: colors.brandOrange },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  rowBody: { flex: 1 },
  rowName: { fontFamily: fontMonoBold, fontSize: 13, color: colors.foreground },
  rowMeta: { fontFamily: fontMono, fontSize: 11, color: colors.mutedForeground, marginTop: 1 },
  rowRight: { alignItems: 'flex-end' },
  rowRelative: { fontFamily: fontMono, fontSize: 11, color: colors.mutedForeground },
  rowRelativeAccent: { color: colors.brandOrange },
  rowAmount: { fontFamily: fontMonoBold, fontSize: 13, color: colors.foreground, marginTop: 1 },
});
