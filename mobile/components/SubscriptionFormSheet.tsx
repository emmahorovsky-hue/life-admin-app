import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { format, differenceInCalendarDays } from 'date-fns';
import {
  Subscription,
  SubscriptionCandidate,
  SubscriptionFormValues,
  defaultSubscriptionFormValues,
  categories,
  currencies,
  currencySymbol,
  filterSuggestions,
  suggestionCost,
  formatCurrency,
  parseRenewalDate,
  radius,
  relativeDaysSigned,
  getSubscriptionStatus,
  ServiceSuggestion,
} from '@life-admin/shared';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionApi } from '../lib/subscriptions';
import { candidateToFormPrefill } from '../lib/receiptScan';
import { categoryIconFor } from '../lib/subscriptionLogo';
import {
  IconScan,
  IconCalendar,
  IconCancelled,
  IconSubscriptions,
  IconDelete,
} from './icons';
import { getApiErrorMessage } from '../lib/utils';
import { SubscriptionLogo } from './SubscriptionLogo';
import {
  AppText,
  Button,
  Dropdown,
  FieldLabel,
  GlassSheetBackground,
  SheetAmountInput,
  Switch,
} from './ui';
import { colors, fonts, textStyles } from '../lib/theme';
import { SHEET_BACKDROP_OPACITY, SHEET_HANDLE } from '../lib/quiet';
import { useSheetBackHandler } from '../lib/useSheetBackHandler';

// Segmented billing control — 4 canonical cycles. Legacy 'annual' maps to 'yearly'.
const CURRENCY_OPTIONS = currencies.map((code) => ({ value: code, meta: currencySymbol(code) }));

const CYCLE_SEGMENTS = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' },
];

export interface SubscriptionFormSheetHandle {
  /** Open the sheet — pass a subscription to edit, or null to add. */
  open: (subscription: Subscription | null) => void;
  /** Open the add sheet pre-filled with a receipt-extracted candidate for review. */
  openWithCandidate: (candidate: SubscriptionCandidate) => void;
}

// Friendly names for fields the extraction was unsure about, shown in the review banner.
const UNCERTAIN_FIELD_LABELS: Record<string, string> = {
  name: 'name',
  cost: 'cost',
  currency: 'currency',
  billingCycle: 'billing cycle',
  renewalDate: 'renewal date',
  category: 'category',
  notes: 'notes',
};

interface Props {
  /** Called after any successful mutation (create/update/cancel/resume/delete). */
  onSaved: () => void;
}

/**
 * Resolves a category to its icon component. A tiny wrapper so the lookup can
 * happen inside a `.map()` without assigning a component to a local mid-render.
 */
function CategoryGlyph({
  category,
  size,
  color,
  ink,
}: {
  category: string;
  size: number;
  color: string;
  ink?: 'brand' | 'inherit';
}) {
  const Icon = categoryIconFor(category);
  return <Icon size={size} color={color} ink={ink} />;
}

export const SubscriptionFormSheet = forwardRef<SubscriptionFormSheetHandle, Props>(
  function SubscriptionFormSheet({ onSaved }, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const { user } = useAuth();
    // A blank form opens in the account's own currency — whatever first-run
    // setup (or Account › Default currency) settled on. `blankValues` is read at
    // open time rather than mount, so a change mid-session is picked up.
    const blankValues = useCallback(
      () => defaultSubscriptionFormValues(user?.defaultCurrency),
      [user?.defaultCurrency],
    );
    const [editing, setEditing] = useState<Subscription | null>(null);
    // Kept outside `values` because SubscriptionFormValues is the shared
    // create/update shape and this is an edit-only property of an existing row.
    const [remindersMuted, setRemindersMuted] = useState(false);
    const [values, setValues] = useState<SubscriptionFormValues>(blankValues);
    // Cost is kept as raw text so partial input ("12.") doesn't fight the keyboard.
    const [costText, setCostText] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);
    const [currencyOpen, setCurrencyOpen] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    // Fields the receipt extraction flagged as low-confidence, for the review banner.
    // Empty for a plain add/edit.
    const [uncertainFields, setUncertainFields] = useState<string[]>([]);
    // Drives the Android back handler only — this sheet cannot use FormSheet's
    // chrome, so it wires back up by hand. See useSheetBackHandler.
    const [presented, setPresented] = useState(false);

    useSheetBackHandler(
      presented,
      useCallback(() => sheetRef.current?.dismiss(), []),
    );

    const mode = editing ? 'edit' : 'add';

    // Light haptics for discrete selections (segments, tiles, dropdown); a
    // success notification on a completed mutation. All best-effort — a
    // rejected promise (e.g. simulator without a Taptic Engine) is swallowed.
    const selectHaptic = useCallback(() => {
      Haptics.selectionAsync().catch(() => {});
    }, []);
    const successHaptic = useCallback(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, []);

    // decimal-pad shows a comma key in comma-decimal locales (e.g. de/fr);
    // parseFloat("12,99") would silently truncate to 12.
    const parseCost = (text: string) => parseFloat(text.replace(',', '.'));

    useImperativeHandle(ref, () => ({
      open: (subscription) => {
        setEditing(subscription);
        if (subscription) {
          setValues({
            name: subscription.name,
            cost: parseFloat(subscription.cost),
            currency: subscription.currency,
            billingCycle: subscription.billingCycle,
            renewalDate: subscription.nextRenewalDate.slice(0, 10),
            category: subscription.category,
            notes: subscription.notes ?? '',
          });
          setCostText(parseFloat(subscription.cost).toString());
          setRemindersMuted(subscription.remindersMuted);
        } else {
          setValues(blankValues());
          setCostText('');
          setRemindersMuted(false);
        }
        setUncertainFields([]);
        setError('');
        setSuggestionsOpen(false);
        setCurrencyOpen(false);
        setShowDatePicker(false);
        setPresented(true);
        sheetRef.current?.present();
      },
      openWithCandidate: (candidate) => {
        setEditing(null);
        const prefill = candidateToFormPrefill(candidate);
        setValues({ ...blankValues(), ...prefill.values });
        setCostText(prefill.costText);
        setRemindersMuted(false);
        setUncertainFields(prefill.uncertainFields);
        setError('');
        setSuggestionsOpen(false);
        setCurrencyOpen(false);
        setShowDatePicker(false);
        setPresented(true);
        sheetRef.current?.present();
      },
    }));

    const patch = (next: Partial<SubscriptionFormValues>) =>
      setValues((prev) => ({ ...prev, ...next }));

    // The list price in the currency the form is *currently* set to — the row
    // the user tapped quoted that number, so filling in a different one (the US
    // price under a £ sign) would contradict what they just read.
    const applySuggestion = (s: ServiceSuggestion) => {
      const cost = suggestionCost(s, values.currency);
      setValues((prev) => ({ ...prev, name: s.name, category: s.category, cost, billingCycle: s.cycle }));
      setCostText(cost.toString());
      setSuggestionsOpen(false);
    };

    const close = useCallback(() => sheetRef.current?.dismiss(), []);

    const finish = useCallback(() => {
      close();
      onSaved();
    }, [close, onSaved]);

    const handleSubmit = async () => {
      const cost = parseCost(costText);
      if (!values.name.trim()) return setError('Service name is required.');
      if (!Number.isFinite(cost) || cost <= 0) return setError('Enter a cost greater than 0.');

      setError('');
      setLoading(true);
      try {
        const data = {
          name: values.name.trim(),
          cost,
          currency: values.currency,
          billingCycle: values.billingCycle,
          renewalDate: values.renewalDate,
          category: values.category,
          notes: values.notes.trim() || undefined,
        };
        if (editing) {
          // Edit-only: a subscription that doesn't exist yet has nothing to mute.
          await subscriptionApi.update(editing.id, { ...data, remindersMuted });
        } else {
          await subscriptionApi.create(data);
        }
        successHaptic();
        finish();
      } catch (err) {
        setError(getApiErrorMessage(err, `Failed to ${mode === 'add' ? 'add' : 'update'} subscription.`));
      } finally {
        setLoading(false);
      }
    };

    const runAction = async (action: () => Promise<unknown>, failMessage: string) => {
      setLoading(true);
      try {
        await action();
        successHaptic();
        finish();
      } catch (err) {
        setError(getApiErrorMessage(err, failMessage));
      } finally {
        setLoading(false);
      }
    };

    const confirmCancelRenewal = () => {
      if (!editing) return;
      Alert.alert(
        'Cancel subscription?',
        `Paypr will stop renewing ${values.name || 'this subscription'}. It stays active until the period end.`,
        [
          { text: 'Keep it', style: 'cancel' },
          {
            text: 'Yes, cancel it',
            style: 'destructive',
            onPress: () =>
              runAction(() => subscriptionApi.cancel(editing.id), 'Failed to cancel subscription.'),
          },
        ],
      );
    };

    const confirmDelete = () => {
      if (!editing) return;
      Alert.alert(
        'Delete subscription?',
        `Delete ${values.name || 'this subscription'}? This can't be undone.`,
        [
          { text: 'Keep it', style: 'cancel' },
          {
            text: 'Yes, delete it',
            style: 'destructive',
            onPress: () =>
              runAction(() => subscriptionApi.delete(editing.id), 'Failed to delete subscription.'),
          },
        ],
      );
    };

    // ── Derived values ─────────────────────────────────────────────────────
    const activeCycle = values.billingCycle === 'annual' ? 'yearly' : values.billingCycle;
    const suggestions = suggestionsOpen ? filterSuggestions(values.name) : [];
    const editStatus = editing ? getSubscriptionStatus(editing) : 'active';

    const renewalAsDate = useMemo(() => {
      const d = parseRenewalDate(values.renewalDate);
      return Number.isNaN(d.getTime()) ? new Date() : d;
    }, [values.renewalDate]);
    const relativeLabel = relativeDaysSigned(differenceInCalendarDays(renewalAsDate, new Date()));

    const snapPoints = useMemo(() => ['88%'], []);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          // The 0.2 glass scrim, matching FormSheet — every sheet in the app
          // is glass now, text entry included.
          opacity={SHEET_BACKDROP_OPACITY}
        />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        onDismiss={() => setPresented(false)}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backgroundComponent={GlassSheetBackground}
        handleIndicatorStyle={SHEET_HANDLE}
      >
        <BottomSheetScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Brand period, matching every FormSheet title. */}
          <AppText variant="title" style={styles.title}>
            {mode === 'add' ? 'Add subscription' : 'Edit subscription'}
            <Text style={styles.titleAccent}>.</Text>
          </AppText>

          {/* Receipt-scan review banner — flags fields the extraction was unsure about. */}
          {uncertainFields.length > 0 && (
            <View style={styles.reviewBanner}>
              <IconScan size={16} color={colors.brandOrange} ink="inherit" />
              <AppText variant="caption" style={styles.reviewBannerText}>
                Scanned from your receipt — please double-check{' '}
                {uncertainFields.map((f) => UNCERTAIN_FIELD_LABELS[f] ?? f).join(', ')}.
              </AppText>
            </View>
          )}

          {/* Service (autocomplete) */}
          <FieldLabel style={styles.firstFieldLabel}>SERVICE</FieldLabel>
          <View style={styles.serviceAnchor}>
            <View style={styles.serviceRow}>
              <SubscriptionLogo name={values.name || '?'} category={values.category} size={36} />
              <BottomSheetTextInput
                style={[textStyles.body, styles.serviceInput]}
                value={values.name}
                editable={!loading}
                placeholder="Search Netflix, Spotify, Figma…"
                placeholderTextColor={colors.mutedForeground}
                onChangeText={(name) => {
                  patch({ name });
                  setSuggestionsOpen(true);
                }}
                onFocus={() => setSuggestionsOpen(true)}
              />
            </View>
            {/* Floats over the fields below (absolute) so it never reflows the form. */}
            {suggestions.length > 0 && (
              <View style={styles.suggestions}>
                {suggestions.map((s) => (
                  <Pressable key={s.name} style={styles.suggestionRow} onPress={() => applySuggestion(s)}>
                    <View style={styles.suggestionIcon}>
                      <CategoryGlyph category={s.category} size={15} color={colors.foreground} />
                    </View>
                    <AppText variant="body" weight={500} style={styles.suggestionName}>{s.name}</AppText>
                    <AppText variant="monoMeta" style={styles.suggestionCost}>{formatCurrency(suggestionCost(s, values.currency), values.currency)}</AppText>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Cost + Currency */}
          <View style={styles.fieldRow}>
            <View style={{ flex: 1 }}>
              <FieldLabel style={styles.fieldLabel}>COST</FieldLabel>
              <SheetAmountInput
                currency={values.currency}
                value={costText}
                editable={!loading}
                onChangeText={setCostText}
                accessibilityLabel={`Cost in ${values.currency}`}
              />
            </View>
            <View style={styles.currencyField}>
              <FieldLabel style={styles.fieldLabel}>CURRENCY</FieldLabel>
              {/* Floats over the fields below so opening it never reflows the form. */}
              <Dropdown
                value={values.currency}
                options={CURRENCY_OPTIONS}
                open={currencyOpen}
                disabled={loading}
                accessibilityLabel={`Currency, ${values.currency}`}
                onToggle={() => {
                  selectHaptic();
                  setSuggestionsOpen(false);
                  setCurrencyOpen((v) => !v);
                }}
                onSelect={(code) => {
                  selectHaptic();
                  patch({ currency: code });
                  setCurrencyOpen(false);
                }}
              />
            </View>
          </View>

          {/* Billing cycle — segmented */}
          <FieldLabel style={styles.fieldLabel}>BILLING CYCLE</FieldLabel>
          <View style={styles.segmentRow}>
            {CYCLE_SEGMENTS.map((seg) => {
              const active = activeCycle === seg.id;
              return (
                <Pressable
                  key={seg.id}
                  disabled={loading}
                  onPress={() => {
                    selectHaptic();
                    patch({ billingCycle: seg.id });
                  }}
                  style={[styles.cycleSegment, active && styles.segmentActive]}
                >
                  <AppText variant="caption" weight={500} style={[styles.segmentText, active && styles.segmentTextActive]}>{seg.label}</AppText>
                </Pressable>
              );
            })}
          </View>

          {/* Date */}
          <FieldLabel style={styles.fieldLabel}>
            {mode === 'edit' ? 'NEXT RENEWAL' : 'FIRST PAYMENT'}
          </FieldLabel>
          <View style={styles.dateAnchor}>
            <Pressable
              style={styles.dateBox}
              disabled={loading}
              onPress={() => setShowDatePicker((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showDatePicker }}
            >
              <View style={styles.dateBoxLeft}>
                <IconCalendar size={16} color={colors.mutedForeground} />
                <AppText variant="monoData" style={styles.dateText}>{format(renewalAsDate, 'MMM d, yyyy')}</AppText>
              </View>
              <AppText variant="monoMeta" style={styles.dateRelative}>{relativeLabel}</AppText>
            </Pressable>
            {/* iOS: float the calendar over the fields below; a day-tap applies and closes. */}
            {showDatePicker && Platform.OS === 'ios' && (
              <View style={styles.dateMenu}>
                <DateTimePicker
                  value={renewalAsDate}
                  mode="date"
                  display="inline"
                  onChange={(event, date) => {
                    if (event.type === 'set' && date) {
                      patch({ renewalDate: format(date, 'yyyy-MM-dd') });
                    }
                    setShowDatePicker(false); // commit-and-dismiss on selection
                  }}
                />
              </View>
            )}
          </View>
          {/* Android: native modal dialog (its own overlay), not inline. */}
          {showDatePicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={renewalAsDate}
              mode="date"
              display="default"
              onChange={(event, date) => {
                setShowDatePicker(false);
                if (event.type === 'set' && date) {
                  patch({ renewalDate: format(date, 'yyyy-MM-dd') });
                }
              }}
            />
          )}

          {/* Category chips — compact icon + label pills that wrap. */}
          <FieldLabel style={styles.fieldLabel}>CATEGORY</FieldLabel>
          <View style={styles.categoryChips}>
            {categories.map((cat) => {
              const active = values.category === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  disabled={loading}
                  onPress={() => {
                    selectHaptic();
                    patch({ category: cat.id });
                  }}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                >
                  <CategoryGlyph
                    category={cat.id}
                    size={14}
                    color={active ? colors.brandOrange : colors.mutedForeground}
                    ink={active ? 'inherit' : 'brand'}
                  />
                  <AppText variant="caption" weight={500} style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                    {cat.name}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          {/* Notes */}
          <FieldLabel style={styles.fieldLabel}>NOTES — OPTIONAL</FieldLabel>
          <BottomSheetTextInput
            style={[textStyles.body, styles.notesInput]}
            value={values.notes}
            editable={!loading}
            multiline
            placeholder="Plan, who it's shared with, cancel-by date…"
            placeholderTextColor={colors.mutedForeground}
            onChangeText={(notes) => patch({ notes })}
          />

          {/* Renewal reminders — edit only, mirroring web's EditSubscriptionDialog.
              Framed positively ("reminders on") rather than as a mute, so the
              switch reads the same way round as every other one in the app. */}
          {mode === 'edit' && (
            <View style={styles.reminderRow}>
              <View style={styles.reminderText}>
                <FieldLabel style={styles.fieldLabel}>RENEWAL REMINDERS</FieldLabel>
                <AppText variant="footnote" style={styles.reminderHint}>
                  Include this subscription in reminders before it renews.
                </AppText>
              </View>
              <Switch
                checked={!remindersMuted}
                disabled={loading}
                onCheckedChange={(enabled) => setRemindersMuted(!enabled)}
              />
            </View>
          )}

          {error ? <AppText variant="footnote" style={styles.error}>{error}</AppText> : null}

          <Button
            title={mode === 'add' ? 'Add subscription' : 'Save changes'}
            loading={loading}
            onPress={handleSubmit}
            style={styles.submitButton}
          />

          {mode === 'edit' && (
            <View style={styles.editActions}>
              <View style={styles.editDivider} />
              {editStatus === 'active' && (
                <Pressable disabled={loading} onPress={confirmCancelRenewal} style={styles.editAction}>
                  <IconCancelled size={18} color={colors.brandOrange} ink="inherit" />
                  <AppText variant="footnote" weight={600} style={styles.cancelActionText}>Cancel subscription</AppText>
                </Pressable>
              )}
              {editStatus === 'cancelling' && (
                <Pressable
                  disabled={loading}
                  onPress={() =>
                    editing &&
                    runAction(() => subscriptionApi.resume(editing.id), 'Failed to resume subscription.')
                  }
                  style={styles.editAction}
                >
                  <IconSubscriptions size={18} color={colors.foreground} />
                  <AppText variant="footnote" weight={600} style={styles.resumeActionText}>Resume subscription</AppText>
                </Pressable>
              )}
              <Pressable disabled={loading} onPress={confirmDelete} style={styles.editAction}>
                <IconDelete size={18} color={colors.destructive} ink="inherit" />
                <AppText variant="footnote" weight={600} style={styles.deleteActionText}>Delete</AppText>
              </Pressable>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  content: { padding: 22, paddingBottom: 48 },
  title: { color: colors.foreground, marginBottom: 16 },
  titleAccent: { color: colors.brandOrange },

  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(229,61,0,0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  reviewBannerText: { flex: 1, color: colors.foreground },

  // Space before each field group — the main lever for the form's vertical rhythm.
  fieldLabel: { marginTop: 24 },
  // First field sits right under the title, so it needs less top space than the rest.
  firstFieldLabel: { marginTop: 8 },
  /**
   * Every popover in this form opens *downwards*, so a row that can open one has
   * to outrank every row after it. They are therefore ranked in descending
   * source order — service 50 → cost/currency 40 → date 30 — rather than all
   * sharing one level.
   *
   * Sharing a level is what broke it: RN settles a zIndex tie by source order,
   * so with `fieldRow` and `dateAnchor` both at 20 the date field (later in the
   * tree) painted over the open currency menu and swallowed its last option.
   * Raising only the offender would just move the bug up a row, which is why
   * all three are set together and why the numbers are spaced.
   */
  fieldRow: { flexDirection: 'row', gap: 12, zIndex: 40 },

  serviceAnchor: { position: 'relative', zIndex: 50 },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
  },
  serviceInput: { flex: 1, fontFamily: fonts.sans.medium, color: colors.foreground },

  suggestions: {
    position: 'absolute',
    top: 56, // serviceRow height (52) + 4 gap
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    backgroundColor: colors.card,
    overflow: 'hidden',
    zIndex: 40,
    // Float above the form: shadow (iOS) + elevation (Android).
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8 },
  suggestionIcon: {
    width: 26,
    height: 26,
    borderRadius: radius.base,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionName: { flex: 1, color: colors.foreground },
  suggestionCost: { color: colors.mutedForeground },


  segmentRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  cycleSegment: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.foreground },

  // Currency dropdown — the trigger matches the cost box height (ui/Dropdown's
  // `field` size). Clearing the fields *below* is `fieldRow`'s job, not this
  // one's; the zIndex here only orders the menu above the cost column beside it.
  currencyField: { width: 120, zIndex: 20 },
  segmentText: { color: colors.foreground },
  segmentTextActive: { color: colors.background, fontFamily: fonts.sans.semibold },

  dateAnchor: { position: 'relative', zIndex: 30 },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
  },
  dateBoxLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateText: { color: colors.foreground },
  dateRelative: { color: colors.brandOrange },
  // Calendar floats over the fields below (absolute) so it never reflows the form.
  dateMenu: {
    position: 'absolute',
    top: 48, // dateBox height (44) + 4 gap
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    backgroundColor: colors.card,
    paddingHorizontal: 8,
    overflow: 'hidden',
    zIndex: 30,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },

  categoryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    backgroundColor: colors.card,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  categoryChipActive: { borderColor: colors.brandOrange, backgroundColor: 'rgba(229,61,0,0.08)' },
  categoryChipText: { color: colors.mutedForeground },
  categoryChipTextActive: { color: colors.brandOrange, fontFamily: fonts.sans.semibold },

  notesInput: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    backgroundColor: colors.card,
    padding: 12,
    color: colors.foreground,
    textAlignVertical: 'top',
  },

  // The label carries its own marginTop (fieldLabel), so the row aligns the
  // switch to the block as a whole rather than adding vertical space of its own.
  reminderRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  reminderText: { flex: 1, minWidth: 0 },
  reminderHint: { marginTop: 4, color: colors.mutedForeground },

  error: { color: colors.destructive, marginTop: 16 },

  submitButton: { marginTop: 28 },

  editActions: {
    marginTop: 20,
  },
  editDivider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginBottom: 6,
  },
  editAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  cancelActionText: { color: colors.brandOrange },
  resumeActionText: { color: colors.foreground },
  deleteActionText: { color: colors.destructive },
});
