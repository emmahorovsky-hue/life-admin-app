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
  Subscription,
  categories,
  formatCurrency,
  getSubscriptionStatus,
  normalizeToMonthlyCost,
  radius,
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
import { AppText, Button, ScreenTitle } from '../../components/ui';
import { colors, textStyles } from '../../lib/theme';

const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

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
          style={[styles.row, status === 'ended' && styles.rowEnded]}
          onPress={() => sheetRef.current?.open(sub)}
        >
          <SubscriptionLogo name={sub.name} category={sub.category} size={40} style={styles.logo} />
          <View style={styles.rowBody}>
            <View style={styles.rowTitleLine}>
              <AppText variant="headline" weight={500} style={styles.rowName} numberOfLines={1}>
                {sub.name}
              </AppText>
              {/* Category tag hidden for now — status pills below still show. */}
              {status === 'cancelling' && (
                <View style={[styles.pill, styles.pillWarning]}>
                  <AppText variant="monoLabel" numberOfLines={1} style={styles.pillTextWarning}>
                    Ends {format(new Date(sub.nextRenewalDate), 'MMM d')}
                  </AppText>
                </View>
              )}
              {status === 'ended' && (
                <View style={[styles.pill, styles.pillEnded]}>
                  <AppText variant="monoLabel" style={styles.pillTextEnded}>Ended</AppText>
                </View>
              )}
            </View>
            <AppText variant="footnote" style={styles.rowSub} numberOfLines={1}>
              {status === 'cancelling'
                ? 'Cancelling'
                : status === 'ended'
                  ? `Ended ${endLabel}`
                  : `Next renewal ${format(new Date(sub.nextRenewalDate), 'MMM d')}`}
            </AppText>
          </View>
          <View style={styles.rowRight}>
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
    <View style={styles.screen}>
      <View style={styles.header}>
        <ScreenTitle>Subscriptions</ScreenTitle>
        <Pressable style={styles.addButton} onPress={() => chooserRef.current?.open()}>
          <Ionicons name="add" size={18} color={colors.background} />
          <AppText variant="body" weight={600} style={styles.addButtonText}>Add</AppText>
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[textStyles.body, styles.searchInput]}
          placeholder="Search subscriptions…"
          placeholderTextColor={colors.mutedForeground}
          value={searchTerm}
          onChangeText={setSearchTerm}
          autoCapitalize="none"
        />
        {searchTerm.length > 0 && (
          <Pressable onPress={() => setSearchTerm('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
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
              onPress={() => setCategoryFilter(cat.id)}
            >
              <AppText variant="caption" weight={500} style={[styles.chipText, active && styles.chipTextActive]}>{cat.name}</AppText>
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
        <FlatList
          data={filtered}
          keyExtractor={(sub) => sub.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.foreground,
    borderRadius: radius.base,
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 8,
  },
  addButtonText: { color: colors.background },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: colors.foreground },

  chips: { flexGrow: 0, marginBottom: 6 },
  chipsContent: { paddingHorizontal: 16, gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  chipText: { color: colors.foreground },
  chipTextActive: { color: colors.background },

  error: {
    color: colors.destructive,
    marginHorizontal: 16,
    marginBottom: 8,
  },

  listContent: { paddingBottom: 32, flexGrow: 1 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.background,
  },
  rowEnded: { opacity: 0.55 },
  logo: { borderRadius: 10 },

  rowBody: { flex: 1, gap: 4, minWidth: 0 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { color: colors.foreground, flexShrink: 1 },

  // Soft category / status pill sitting beside the name.
  pill: {
    backgroundColor: colors.secondary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 1,
  },
  pillText: { color: colors.mutedForeground, letterSpacing: 1 },
  pillWarning: { backgroundColor: 'rgba(229,61,0,0.10)' },
  pillTextWarning: { color: colors.brandOrange, letterSpacing: 1 },
  pillEnded: { backgroundColor: 'rgba(220,38,38,0.10)' },
  pillTextEnded: { color: colors.destructive, letterSpacing: 1 },

  rowSub: { color: colors.mutedForeground },

  // Right-aligned price stack: bold figure + muted annual equivalent.
  rowRight: { alignItems: 'flex-end', marginLeft: 8, flexShrink: 0 },
  // Bold mono from monoData, sized to 15 (a ladder value) so the price lines
  // up with the 15px name; the shared monoData token stays 13 for other rows.
  rowPrice: { color: colors.foreground, fontSize: 15 },
  rowAnnual: { color: colors.mutedForeground, marginTop: 2 },

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
    color: colors.mutedForeground,
    paddingVertical: 16,
  },
});
