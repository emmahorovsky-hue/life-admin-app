import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import {
  Subscription,
  categories,
  formatCurrency,
  getSubscriptionStatus,
  matchesSubscriptionFilter,
  normalizeToMonthlyCost,
  parseRenewalDate,
  radius,
  ALL_CATEGORIES,
} from '@life-admin/shared';
import { subscriptionApi } from '../../lib/subscriptions';
import { getApiErrorMessage } from '../../lib/utils';
import { SubscriptionLogo } from '../../components/SubscriptionLogo';
import {
  SubscriptionSheets,
  SubscriptionSheetsHandle,
} from '../../components/SubscriptionSheets';
import {
  ReceiptScanChooser,
  ReceiptScanChooserHandle,
} from '../../components/ReceiptScanChooser';
import { EmptyState } from '../../components/EmptyState';
import { AppText, Button, ScreenTitle } from '../../components/ui';
import { colors, fonts, textStyles } from '../../lib/theme';
import { ROW_LOGO, SCREEN_PAD, quiet } from '../../lib/quiet';
import { useTabBarInset } from '../../lib/useTabBarInset';

/** Gutter between the columns, and between grid rows. */
const GRID_GAP = 12;
/** Fixed at build time, so the FlatList needs no `key` to force the remount RN
 *  requires when numColumns changes. Make this dynamic and it will. */
const GRID_COLUMNS = 2;

export default function SubscriptionsScreen() {
  const router = useRouter();
  const tabBarInset = useTabBarInset();
  // Cards are sized explicitly rather than flex:1. A last row holding a single
  // card would otherwise stretch it to the full width and break the grid.
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth =
    (windowWidth - SCREEN_PAD * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const { openAdd } = useLocalSearchParams<{ openAdd?: string }>();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const sheetRef = useRef<SubscriptionSheetsHandle>(null);
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

  // Predicate shared with web (see @life-admin/shared).
  const filtered = subscriptions.filter((sub) =>
    matchesSubscriptionFilter({ subscription: sub, searchTerm, categoryFilter })
  );

  const renderItem = ({ item: sub }: { item: Subscription }) => {
    const status = getSubscriptionStatus(sub);
    const renewal = parseRenewalDate(sub.nextRenewalDate);
    const endLabel = format(renewal, 'MMM d, yyyy');
    const price = formatCurrency(parseFloat(sub.cost), sub.currency);
    const annual = formatCurrency(
      normalizeToMonthlyCost(parseFloat(sub.cost), sub.billingCycle) * 12,
      sub.currency,
    );
    const meta =
      status === 'cancelling'
        ? `Cancelling · ends ${format(renewal, 'MMM d')}`
        : status === 'ended'
          ? `Ended ${endLabel}`
          : `Renews ${format(renewal, 'MMM d')}`;
    return (
      <Pressable
        style={[styles.card, { width: cardWidth }, status === 'ended' && styles.cardEnded]}
        accessibilityRole="button"
        // Collapse the logo/name/meta/price fragments into one spoken label,
        // matching the Timeline row so every subscription surface reads alike.
        accessibilityLabel={`${sub.name}, ${price}, ${meta}`}
        // A half-width card has no room for a swipe-out action, so delete moves
        // to long-press — and to a VoiceOver action, which the swipe never had.
        // Delete also stays reachable the slow way (card → Edit → Delete in
        // SubscriptionFormSheet), so this gesture is a shortcut, not the only path.
        accessibilityHint="Long press to delete"
        accessibilityActions={[{ name: 'delete', label: 'Delete subscription' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'delete') handleDelete(sub);
        }}
        onPress={() => sheetRef.current?.openDetail(sub)}
        onLongPress={() => {
          // The gesture has no on-screen affordance, so the tap-back is the only
          // thing confirming it fired — without it the 500ms before the Alert
          // reads as lag.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          handleDelete(sub);
        }}
      >
        <SubscriptionLogo
          name={sub.name}
          category={sub.category}
          size={ROW_LOGO}
          style={styles.logo}
        />

        {/* Two lines for the name: at half width "Xbox Game Pass Ultimate"
            truncates to nothing on one. */}
        <AppText style={quiet.rowName} numberOfLines={2}>{sub.name}</AppText>
        {/* Status reads as text rather than a coloured pill: this screen spends
            no brand orange at all, and an ended card is already dimmed. */}
        <AppText style={quiet.rowMeta} numberOfLines={1}>{meta}</AppText>

        <View style={styles.cardPrice}>
          <AppText variant="monoData" style={styles.rowPrice} numberOfLines={1}>
            {price}
          </AppText>
          <AppText variant="monoMeta" style={styles.rowAnnual} numberOfLines={1}>
            {annual}/yr
          </AppText>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={quiet.screen}>
      {/* Screen title follows the Settings convention — ScreenTitle's pageTitle
          role + brand-orange period — rather than the Dashboard's quiet header.
          The Dashboard is the one hero screen; the rest of the tabs share this. */}
      <View style={[quiet.header, styles.headerBlock]}>
        <ScreenTitle>Subscriptions</ScreenTitle>
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
        data={[{ id: ALL_CATEGORIES, name: 'All' }, ...categories]}
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
        // A grid (LIF-249). columnWrapperStyle owns the gutter between the pair;
        // the row gap is the cards' own marginBottom, so the empty state — which
        // renders as a single full-width child — is unaffected.
        <FlatList
          data={filtered}
          numColumns={GRID_COLUMNS}
          columnWrapperStyle={styles.column}
          keyExtractor={(sub) => sub.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: tabBarInset }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            searchTerm || categoryFilter !== ALL_CATEGORIES ? (
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
                      setCategoryFilter(ALL_CATEGORIES);
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

      <SubscriptionSheets ref={sheetRef} onSaved={load} />
      <ReceiptScanChooser
        ref={chooserRef}
        onManual={() => sheetRef.current?.openAdd()}
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

  headerBlock: { paddingHorizontal: SCREEN_PAD, paddingTop: SCREEN_PAD, marginBottom: 18 },
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

  // Don't grow this margin to space the grid off the filters — the chip row is a
  // horizontal ScrollView with no fixed height, and taking height off it here
  // clips the pills. The gap lives in listContent's paddingTop instead.
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

  // paddingBottom is applied dynamically via useTabBarInset to clear the glass tab bar.
  // paddingTop + the chip row's 4pt margin puts 18pt above the first row of cards:
  // more than the 12pt between rows, so the grid starts on a section break rather
  // than looking like a row that lost its neighbour. Rows had no edge here and
  // could sit on the 4pt alone; a card's border can't.
  listContent: { paddingHorizontal: SCREEN_PAD, paddingTop: 14, flexGrow: 1 },
  column: { gap: GRID_GAP },

  // A grid can't rule its items apart the way stacked rows do, so the card is
  // the one place this screen departs from "hairlines, not boxes": a white
  // surface on Snow with a hairline edge, which is the lightest boundary that
  // still separates two cards sitting side by side.
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.base,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: 14,
    marginBottom: GRID_GAP,
  },
  cardEnded: { opacity: 0.55 },
  logo: { borderRadius: 8, marginBottom: 10 },

  // The figures close the card, pinned to its bottom edge rather than following
  // the meta line. columnWrapperStyle stretches both cards in a pair to the
  // taller one's height, so top-flowed figures sit at different heights when one
  // name wraps to two lines and its neighbour doesn't — on the screen you open
  // to compare what you're paying, of all places. `auto` pushes them down; the
  // padding keeps the gap a plain marginTop was buying.
  cardPrice: { marginTop: 'auto', paddingTop: 10 },
  rowPrice: { color: colors.foreground, fontSize: 15 },
  rowAnnual: { color: colors.softMuted, marginTop: 2 },

  footerCount: {
    textAlign: 'center',
    color: colors.softMuted,
    paddingVertical: 20,
  },
});
