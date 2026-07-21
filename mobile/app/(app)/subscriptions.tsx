import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import {
  DEFAULT_CURRENCY,
  Subscription,
  categories,
  dominantCurrency,
  formatCurrency,
  formatCurrencyTotals,
  getSubscriptionStatus,
  normalizeToMonthlyCost,
  radius,
  sumByCurrency,
} from '@life-admin/shared';
import { subscriptionApi } from '../../lib/subscriptions';
import { getApiErrorMessage } from '../../lib/utils';
import { SubscriptionLogo } from '../../components/SubscriptionLogo';
import {
  SubscriptionFormSheet,
  SubscriptionFormSheetHandle,
} from '../../components/SubscriptionFormSheet';
import {
  ReceiptScanChooser,
  ReceiptScanChooserHandle,
} from '../../components/ReceiptScanChooser';
import { EmptyState } from '../../components/EmptyState';
import { AppText, Button } from '../../components/ui';
import { colors, fonts, textStyles } from '../../lib/theme';
import { ROW_LOGO, SCREEN_PAD, quiet } from '../../lib/quiet';

// Monthly run-rate for the header sub-line, per currency — costs in different
// currencies are never summed (LIF-107), so this can be several lines joined.
// Ended subscriptions are excluded: they aren't charging any more.
function monthlyRunRate(subs: Subscription[]): string {
  const live = subs.filter((sub) => getSubscriptionStatus(sub) !== 'ended');
  const totals = sumByCurrency(
    live.map((sub) => ({
      currency: sub.currency,
      amount: normalizeToMonthlyCost(parseFloat(sub.cost), sub.billingCycle),
    })),
    dominantCurrency(live.map((sub) => sub.currency)),
  );
  return formatCurrencyTotals(totals, DEFAULT_CURRENCY).join(' / ');
}

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { openAdd } = useLocalSearchParams<{ openAdd?: string }>();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const sheetRef = useRef<SubscriptionFormSheetHandle>(null);
  const chooserRef = useRef<ReceiptScanChooserHandle>(null);

  const load = useCallback(async () => {
    try {
      const data = await subscriptionApi.getAll();
      setSubscriptions(data);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load subscriptions'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Open the add chooser when navigated here from an "add" button elsewhere
  // (e.g. the Dashboard empty state). Clear the param so it doesn't re-fire —
  // with '' rather than undefined, which expo-router can serialize to the
  // literal string "undefined" (truthy, and it would wedge the effect).
  useEffect(() => {
    if (openAdd) {
      chooserRef.current?.open();
      router.setParams({ openAdd: '' });
    }
  }, [openAdd, router]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleDelete = (sub: Subscription) => {
    Alert.alert('Delete subscription?', `Delete ${sub.name}? This can't be undone.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Yes, delete it',
        style: 'destructive',
        onPress: async () => {
          try {
            await subscriptionApi.delete(sub.id);
            await load();
          } catch (err) {
            Alert.alert('Error', getApiErrorMessage(err, 'Failed to delete subscription'));
          }
        },
      },
    ]);
  };

  const filtered = subscriptions.filter((sub) => {
    const matchesSearch = sub.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || sub.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const renderItem = ({ item: sub }: { item: Subscription }) => {
    const status = getSubscriptionStatus(sub);
    const endLabel = format(new Date(sub.nextRenewalDate), 'MMM d, yyyy');
    return (
      <ReanimatedSwipeable
        friction={2}
        rightThreshold={40}
        overshootRight={false}
        renderRightActions={() => (
          <Pressable style={styles.deleteAction} onPress={() => handleDelete(sub)}>
            <Ionicons name="trash-outline" size={22} color={colors.white} />
            <AppText variant="caption" weight={600} style={styles.deleteActionText}>Delete</AppText>
          </Pressable>
        )}
      >
        <Pressable
          style={[quiet.row, styles.row, status === 'ended' && styles.rowEnded]}
          onPress={() => sheetRef.current?.open(sub)}
        >
          <SubscriptionLogo
            name={sub.name}
            category={sub.category}
            size={ROW_LOGO}
            style={styles.logo}
          />
          <View style={quiet.rowBody}>
            <AppText style={quiet.rowName} numberOfLines={1}>{sub.name}</AppText>
            {/* Status reads as text rather than a coloured pill — the Quiet
                language spends brand orange only on the due-soon dot, and an
                ended row is already dimmed. */}
            <AppText style={quiet.rowMeta} numberOfLines={1}>
              {status === 'cancelling'
                ? `Cancelling · ends ${format(new Date(sub.nextRenewalDate), 'MMM d')}`
                : status === 'ended'
                  ? `Ended ${endLabel}`
                  : `Renews ${format(new Date(sub.nextRenewalDate), 'MMM d')}`}
            </AppText>
          </View>
          <View style={quiet.rowRight}>
            <AppText variant="monoData" style={styles.rowPrice} numberOfLines={1}>
              {formatCurrency(parseFloat(sub.cost), sub.currency)}
            </AppText>
            <AppText variant="monoMeta" style={styles.rowAnnual} numberOfLines={1}>
              {formatCurrency(normalizeToMonthlyCost(parseFloat(sub.cost), sub.billingCycle) * 12, sub.currency)}/yr
            </AppText>
          </View>
        </Pressable>
      </ReanimatedSwipeable>
    );
  };

  return (
    <View style={quiet.screen}>
      <View style={styles.headerBlock}>
        <View style={quiet.header}>
          <AppText variant="headline" accessibilityRole="header" style={quiet.headerTitle}>
            Subscriptions
          </AppText>
          <Pressable
            style={styles.addButton}
            accessibilityRole="button"
            accessibilityLabel="Add subscription"
            onPress={() => chooserRef.current?.open()}
          >
            <Ionicons name="add" size={16} color={colors.background} />
            <AppText style={styles.addButtonText}>Add</AppText>
          </Pressable>
        </View>
        {subscriptions.length > 0 && (
          <AppText style={quiet.headerSub}>
            {subscriptions.length} tracked · {monthlyRunRate(subscriptions)} per month
          </AppText>
        )}
      </View>

      {/* Search — a hairline-ruled field, not a bordered card. */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={colors.softMuted} />
        <TextInput
          style={[textStyles.body, styles.searchInput]}
          placeholder="Search subscriptions…"
          placeholderTextColor={colors.softMuted}
          value={searchTerm}
          onChangeText={setSearchTerm}
          autoCapitalize="none"
        />
        {searchTerm.length > 0 && (
          <Pressable onPress={() => setSearchTerm('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.faint} />
          </Pressable>
        )}
      </View>

      {/* Category filter chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chips}
        contentContainerStyle={styles.chipsContent}
        data={[{ id: 'all', name: 'All' }, ...categories]}
        keyExtractor={(c) => c.id}
        renderItem={({ item: cat }) => {
          const active = categoryFilter === cat.id;
          return (
            <Pressable
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setCategoryFilter(cat.id)}
            >
              <AppText style={[styles.chipText, active && styles.chipTextActive]}>
                {cat.name}
              </AppText>
            </Pressable>
          );
        }}
      />

      {error ? <AppText variant="footnote" style={styles.error}>{error}</AppText> : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandOrange} />
        </View>
      ) : (
        // No ItemSeparatorComponent: quiet.row carries its own hairline bottom
        // rule, matching the Dashboard's renewal rows.
        <FlatList
          data={filtered}
          keyExtractor={(sub) => sub.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            searchTerm || categoryFilter !== 'all' ? (
              <EmptyState
                iconName="search-outline"
                iconVariant="muted"
                kicker="No matches"
                title="No subscriptions match your filters"
                description="Try a different category or clear the search to see everything."
                action={
                  <Button
                    title="Clear filters"
                    variant="outline"
                    onPress={() => {
                      setSearchTerm('');
                      setCategoryFilter('all');
                    }}
                  />
                }
              />
            ) : (
              <EmptyState
                kicker="Nothing filed yet"
                title="No subscriptions yet"
                description="Add your first one and we'll keep an eye on every renewal."
                action={
                  <Button
                    title="Add your first subscription"
                    onPress={() => chooserRef.current?.open()}
                  />
                }
              />
            )
          }
          ListFooterComponent={
            filtered.length > 0 ? (
              <AppText variant="caption" style={styles.footerCount}>
                Showing {filtered.length} of {subscriptions.length} subscriptions
              </AppText>
            ) : null
          }
        />
      )}

      <SubscriptionFormSheet ref={sheetRef} onSaved={load} />
      <ReceiptScanChooser
        ref={chooserRef}
        onManual={() => sheetRef.current?.open(null)}
        onExtracted={(candidate) => sheetRef.current?.openWithCandidate(candidate)}
      />
    </View>
  );
}

// Aligned to the Dashboard's Quiet language (LIF-213): the 28pt content column,
// hairline rules in place of bordered cards, and the 15pt row rhythm all come
// from lib/quiet. Space Mono stays for the tabular price stack — that is the
// identity this list screen keeps.
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerBlock: { paddingHorizontal: SCREEN_PAD, paddingTop: SCREEN_PAD, marginBottom: 22 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.foreground,
    borderRadius: radius.base,
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 7,
  },
  addButtonText: { fontFamily: fonts.sans.semibold, fontSize: 13, color: colors.background },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: SCREEN_PAD,
    height: 38,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  searchInput: { flex: 1, color: colors.foreground },

  chips: { flexGrow: 0, marginTop: 18, marginBottom: 4 },
  chipsContent: { paddingHorizontal: SCREEN_PAD, gap: 8, alignItems: 'center' },
  // Inactive chips are plain text; only the active one takes a surface, so the
  // filter row reads as a line of words rather than a wall of bordered boxes.
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.base },
  chipActive: { backgroundColor: colors.foreground },
  chipText: { fontFamily: fonts.sans.regular, fontSize: 13, color: colors.softMuted },
  chipTextActive: { fontFamily: fonts.sans.medium, color: colors.background },

  error: {
    color: colors.destructive,
    marginHorizontal: SCREEN_PAD,
    marginBottom: 8,
  },

  listContent: { paddingHorizontal: SCREEN_PAD, paddingBottom: 40, flexGrow: 1 },
  // Rhythm and hairline come from quiet.row. This widens the gap for the 36px
  // logo (quiet.row's default suits a 6px dot) and adds the opaque background
  // the swipe-to-delete action slides underneath.
  row: { gap: 12, backgroundColor: colors.background },
  rowEnded: { opacity: 0.55 },
  logo: { borderRadius: 8 },

  // Right-aligned price stack: mono figure + muted annual equivalent.
  rowPrice: { color: colors.foreground, fontSize: 15 },
  rowAnnual: { color: colors.softMuted, marginTop: 2 },

  deleteAction: {
    backgroundColor: colors.destructive,
    alignItems: 'center',
    justifyContent: 'center',
    width: 84,
    gap: 2,
  },
  deleteActionText: { color: colors.white },

  footerCount: {
    textAlign: 'center',
    color: colors.softMuted,
    paddingVertical: 20,
  },
});
