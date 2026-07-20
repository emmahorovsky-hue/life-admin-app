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
import { SubscriptionLogo } from '../../components/SubscriptionLogo';
import { Perforation } from '../../components/Perforation';
import { EmptyState } from '../../components/EmptyState';
import { AppText, Button, ScreenTitle } from '../../components/ui';
import { colors } from '../../lib/theme';

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
            <AppText variant="monoLabel" style={[styles.sectionTitle, isThisWeek && styles.sectionTitleAccent]}>
              {section.title}
            </AppText>
            {isThisWeek && (
              <View style={styles.dueSoonStamp}>
                <AppText variant="monoLabel" style={styles.dueSoonStampText}>DUE SOON</AppText>
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
              <AppText variant="monoData" style={styles.rowName} numberOfLines={1}>
                {sub.name}
              </AppText>
              <AppText variant="monoMeta" style={styles.rowMeta}>
                {format(renewal, 'MMM d')} · {categoryLabel(sub.category)}
              </AppText>
            </View>
            <View style={styles.rowRight}>
              <AppText variant="monoMeta" style={[styles.rowRelative, isThisWeek && styles.rowRelativeAccent]}>
                {relativeDays(days)}
              </AppText>
              <AppText variant="monoData" style={styles.rowAmount}>
                {formatCurrency(parseFloat(sub.cost), sub.currency)}
              </AppText>
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
  mutedText: { color: colors.mutedForeground },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: { color: colors.mutedForeground },
  sectionTitleAccent: { color: colors.brandOrange },
  dueSoonStamp: {
    borderWidth: 1,
    borderColor: colors.brandOrange,
    paddingHorizontal: 6,
    paddingVertical: 2,
    transform: [{ rotate: '-4deg' }],
  },
  dueSoonStampText: { color: colors.brandOrange },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  rowBody: { flex: 1 },
  rowName: { color: colors.foreground },
  rowMeta: { color: colors.mutedForeground, marginTop: 1 },
  rowRight: { alignItems: 'flex-end' },
  rowRelative: { color: colors.mutedForeground },
  rowRelativeAccent: { color: colors.brandOrange },
  rowAmount: { color: colors.foreground, marginTop: 1 },
});
