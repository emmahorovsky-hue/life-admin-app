import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
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
} from '@life-admin/shared';
import { subscriptionApi } from '../../lib/subscriptions';
import { getApiErrorMessage } from '../../lib/utils';
import { SubscriptionLogo } from '../../components/SubscriptionLogo';
import {
  SubscriptionFormSheet,
  SubscriptionFormSheetHandle,
} from '../../components/SubscriptionFormSheet';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/ui';
import { colors, fontMono, fontMonoBold } from '../../lib/theme';

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

  // Open the add sheet when navigated here from an "add" button elsewhere
  // (e.g. the Dashboard empty state). Clear the param so it doesn't re-fire —
  // with '' rather than undefined, which expo-router can serialize to the
  // literal string "undefined" (truthy, and it would wedge the effect).
  useEffect(() => {
    if (openAdd) {
      sheetRef.current?.open(null);
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
            <Text style={styles.deleteActionText}>Delete</Text>
          </Pressable>
        )}
      >
        <Pressable
          style={[styles.row, status === 'ended' && styles.rowEnded]}
          onPress={() => sheetRef.current?.open(sub)}
        >
          <SubscriptionLogo name={sub.name} category={sub.category} size={32} />
          <View style={styles.rowBody}>
            <View style={styles.rowTitleLine}>
              <Text style={styles.rowName} numberOfLines={1}>
                {sub.name}
              </Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{categoryLabel(sub.category)}</Text>
              </View>
              {status === 'cancelling' && (
                <View style={[styles.badge, styles.badgeWarning]}>
                  <Text style={[styles.badgeText, styles.badgeTextLight]}>Ends {endLabel}</Text>
                </View>
              )}
              {status === 'ended' && (
                <View style={[styles.badge, styles.badgeDestructive]}>
                  <Text style={[styles.badgeText, styles.badgeTextLight]}>Ended {endLabel}</Text>
                </View>
              )}
            </View>
            <View style={styles.rowMetaLine}>
              <Text style={styles.rowCost}>
                {formatCurrency(parseFloat(sub.cost), sub.currency)}
              </Text>
              <Text style={styles.rowMeta}>{sub.billingCycle}</Text>
              {status === 'active' && (
                <Text style={styles.rowMeta}>
                  Next: {format(new Date(sub.nextRenewalDate), 'MMM d, yyyy')}
                </Text>
              )}
            </View>
            {sub.notes ? (
              <Text style={styles.rowNotes} numberOfLines={1}>
                {sub.notes}
              </Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
        </Pressable>
      </ReanimatedSwipeable>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.h1}>
          Subscriptions<Text style={styles.accent}>.</Text>
        </Text>
        <Pressable style={styles.addButton} onPress={() => sheetRef.current?.open(null)}>
          <Ionicons name="add" size={18} color={colors.background} />
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={styles.searchInput}
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
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat.name}</Text>
            </Pressable>
          );
        }}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

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
                    onPress={() => sheetRef.current?.open(null)}
                  />
                }
              />
            )
          }
          ListFooterComponent={
            filtered.length > 0 ? (
              <Text style={styles.footerCount}>
                Showing {filtered.length} of {subscriptions.length} subscriptions
              </Text>
            ) : null
          }
        />
      )}

      <SubscriptionFormSheet ref={sheetRef} onSaved={load} />
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
  h1: { fontSize: 26, fontWeight: '800', color: colors.foreground },
  accent: { color: colors.brandOrange },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.foreground,
    borderRadius: 8,
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 8,
  },
  addButtonText: { color: colors.background, fontWeight: '600', fontSize: 14 },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.foreground },

  chips: { flexGrow: 0, marginBottom: 6 },
  chipsContent: { paddingHorizontal: 16, gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  chipText: { fontSize: 12, fontWeight: '500', color: colors.foreground },
  chipTextActive: { color: colors.background },

  error: {
    color: colors.destructive,
    fontSize: 13,
    marginHorizontal: 16,
    marginBottom: 8,
  },

  listContent: { paddingBottom: 32, flexGrow: 1 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.background,
  },
  rowEnded: { opacity: 0.6 },
  rowBody: { flex: 1, gap: 3 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  rowName: { fontSize: 16, fontWeight: '600', color: colors.foreground, flexShrink: 1 },
  badge: {
    backgroundColor: colors.secondary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeWarning: { backgroundColor: colors.warning },
  badgeDestructive: { backgroundColor: colors.destructive },
  badgeText: { fontSize: 10, fontWeight: '600', color: colors.foreground },
  badgeTextLight: { color: colors.white },
  rowMetaLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowCost: { fontFamily: fontMonoBold, fontSize: 13, color: colors.foreground },
  rowMeta: { fontSize: 12, color: colors.mutedForeground },
  rowNotes: { fontSize: 12, color: colors.mutedForeground },

  deleteAction: {
    backgroundColor: colors.destructive,
    alignItems: 'center',
    justifyContent: 'center',
    width: 84,
    gap: 2,
  },
  deleteActionText: { color: colors.white, fontSize: 11, fontWeight: '600' },

  mutedText: { color: colors.mutedForeground, fontSize: 14 },
  footerCount: {
    textAlign: 'center',
    color: colors.mutedForeground,
    fontSize: 12,
    paddingVertical: 16,
  },
});
