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
import { Ionicons } from '@expo/vector-icons';
import { format, differenceInCalendarDays } from 'date-fns';
import {
  Subscription,
  SubscriptionCandidate,
  SubscriptionFormValues,
  defaultSubscriptionFormValues,
  categories,
  currencies,
  currencySymbol,
  formatCurrency,
  normalizeToMonthlyCost,
  parseRenewalDate,
  radius,
  relativeDaysSigned,
  getSubscriptionStatus,
} from '@life-admin/shared';
import { subscriptionApi } from '../lib/subscriptions';
import { candidateToFormPrefill } from '../lib/receiptScan';
import { categoryIconFor } from '../lib/subscriptionLogo';
import { filterSuggestions, ServiceSuggestion } from '../lib/suggestions';
import { getApiErrorMessage } from '../lib/utils';
import { SubscriptionLogo } from './SubscriptionLogo';
import { Button, FieldLabel } from './ui';
import { colors, fontMono, fontMonoBold, fonts } from '../lib/theme';

// Segmented billing control — 4 canonical cycles. Legacy 'annual' maps to 'yearly'.
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

export const SubscriptionFormSheet = forwardRef<SubscriptionFormSheetHandle, Props>(
  function SubscriptionFormSheet({ onSaved }, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const [editing, setEditing] = useState<Subscription | null>(null);
    const [values, setValues] = useState<SubscriptionFormValues>(defaultSubscriptionFormValues());
    // Cost is kept as raw text so partial input ("12.") doesn't fight the keyboard.
    const [costText, setCostText] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    // Fields the receipt extraction flagged as low-confidence, for the review banner.
    // Empty for a plain add/edit.
    const [uncertainFields, setUncertainFields] = useState<string[]>([]);

    const mode = editing ? 'edit' : 'add';

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
        } else {
          setValues(defaultSubscriptionFormValues());
          setCostText('');
        }
        setUncertainFields([]);
        setError('');
        setSuggestionsOpen(false);
        setShowDatePicker(false);
        sheetRef.current?.present();
      },
      openWithCandidate: (candidate) => {
        setEditing(null);
        const prefill = candidateToFormPrefill(candidate);
        setValues({ ...defaultSubscriptionFormValues(), ...prefill.values });
        setCostText(prefill.costText);
        setUncertainFields(prefill.uncertainFields);
        setError('');
        setSuggestionsOpen(false);
        setShowDatePicker(false);
        sheetRef.current?.present();
      },
    }));

    const patch = (next: Partial<SubscriptionFormValues>) =>
      setValues((prev) => ({ ...prev, ...next }));

    const applySuggestion = (s: ServiceSuggestion) => {
      setValues((prev) => ({
        ...prev,
        name: s.name,
        category: s.category,
        cost: s.cost,
        billingCycle: s.cycle,
      }));
      setCostText(s.cost.toString());
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
          await subscriptionApi.update(editing.id, data);
        } else {
          await subscriptionApi.create(data);
        }
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

    // ── Derived preview values ─────────────────────────────────────────────
    const cost = Number.isFinite(parseCost(costText)) ? parseCost(costText) : 0;
    const activeCycle = values.billingCycle === 'annual' ? 'yearly' : values.billingCycle;
    const perMonth = normalizeToMonthlyCost(cost, values.billingCycle);
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
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{mode === 'add' ? 'Add subscription' : 'Edit subscription'}</Text>

          {/* Receipt-scan review banner — flags fields the extraction was unsure about. */}
          {uncertainFields.length > 0 && (
            <View style={styles.reviewBanner}>
              <Ionicons name="scan-outline" size={16} color={colors.brandOrange} />
              <Text style={styles.reviewBannerText}>
                Scanned from your receipt — please double-check{' '}
                {uncertainFields.map((f) => UNCERTAIN_FIELD_LABELS[f] ?? f).join(', ')}.
              </Text>
            </View>
          )}

          {/* Service (autocomplete) */}
          <FieldLabel style={styles.fieldLabel}>SERVICE</FieldLabel>
          <View style={styles.serviceRow}>
            <SubscriptionLogo name={values.name || '?'} category={values.category} size={36} />
            <BottomSheetTextInput
              style={styles.serviceInput}
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
          {suggestions.length > 0 && (
            <View style={styles.suggestions}>
              {suggestions.map((s) => (
                <Pressable key={s.name} style={styles.suggestionRow} onPress={() => applySuggestion(s)}>
                  <View style={styles.suggestionIcon}>
                    <Ionicons name={categoryIconFor(s.category)} size={15} color={colors.foreground} />
                  </View>
                  <Text style={styles.suggestionName}>{s.name}</Text>
                  <Text style={styles.suggestionCost}>{formatCurrency(s.cost, values.currency)}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Cost + Currency */}
          <View style={styles.fieldRow}>
            <View style={{ flex: 1 }}>
              <FieldLabel style={styles.fieldLabel}>COST</FieldLabel>
              <View style={styles.costBox}>
                <Text style={styles.costSymbol}>{currencySymbol(values.currency)}</Text>
                <BottomSheetTextInput
                  style={styles.costInput}
                  value={costText}
                  editable={!loading}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  onChangeText={setCostText}
                />
              </View>
            </View>
            <View style={{ width: 150 }}>
              <FieldLabel style={styles.fieldLabel}>CURRENCY</FieldLabel>
              <View style={styles.segmentRow}>
                {currencies.map((code) => {
                  const active = values.currency === code;
                  return (
                    <Pressable
                      key={code}
                      disabled={loading}
                      onPress={() => patch({ currency: code })}
                      style={[styles.currencySegment, active && styles.segmentActive]}
                    >
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{code}</Text>
                    </Pressable>
                  );
                })}
              </View>
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
                  onPress={() => patch({ billingCycle: seg.id })}
                  style={[styles.cycleSegment, active && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{seg.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Date */}
          <FieldLabel style={styles.fieldLabel}>
            {mode === 'edit' ? 'NEXT RENEWAL' : 'FIRST PAYMENT'}
          </FieldLabel>
          <Pressable
            style={styles.dateBox}
            disabled={loading}
            onPress={() => setShowDatePicker((v) => !v)}
          >
            <Text style={styles.dateText}>{format(renewalAsDate, 'MMM d, yyyy')}</Text>
            <Text style={styles.dateRelative}>{relativeLabel}</Text>
          </Pressable>
          {showDatePicker && (
            <DateTimePicker
              value={renewalAsDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(event, date) => {
                // Android fires 'dismissed' on cancel; hide its dialog either way.
                if (Platform.OS === 'android') setShowDatePicker(false);
                if (event.type === 'set' && date) {
                  patch({ renewalDate: format(date, 'yyyy-MM-dd') });
                }
              }}
            />
          )}

          {/* Category tiles */}
          <FieldLabel style={styles.fieldLabel}>CATEGORY</FieldLabel>
          <View style={styles.categoryGrid}>
            {categories.map((cat) => {
              const active = values.category === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  disabled={loading}
                  onPress={() => patch({ category: cat.id })}
                  style={[styles.categoryTile, active && styles.categoryTileActive]}
                >
                  <Ionicons
                    name={categoryIconFor(cat.id)}
                    size={18}
                    color={active ? colors.brandOrange : colors.mutedForeground}
                  />
                  <Text style={[styles.categoryTileText, active && styles.categoryTileTextActive]}>
                    {cat.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Notes */}
          <FieldLabel style={styles.fieldLabel}>NOTES — OPTIONAL</FieldLabel>
          <BottomSheetTextInput
            style={styles.notesInput}
            value={values.notes}
            editable={!loading}
            multiline
            placeholder="Plan, who it's shared with, cancel-by date…"
            placeholderTextColor={colors.mutedForeground}
            onChangeText={(notes) => patch({ notes })}
          />

          {/* Normalized preview */}
          <View style={styles.previewRow}>
            <Text style={styles.previewText}>
              {formatCurrency(perMonth, values.currency)} / month ·{' '}
              {formatCurrency(perMonth * 12, values.currency)} / year
            </Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title={mode === 'add' ? 'Add subscription' : 'Save changes'}
            loading={loading}
            onPress={handleSubmit}
            style={styles.submitButton}
          />

          {mode === 'edit' && (
            <View style={styles.editActions}>
              {editStatus === 'active' && (
                <Pressable disabled={loading} onPress={confirmCancelRenewal} style={styles.editAction}>
                  <Text style={styles.cancelActionText}>Cancel subscription</Text>
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
                  <Text style={styles.resumeActionText}>Resume subscription</Text>
                </Pressable>
              )}
              <Pressable disabled={loading} onPress={confirmDelete} style={styles.editAction}>
                <Text style={styles.deleteActionText}>Delete</Text>
              </Pressable>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  sheetBackground: { backgroundColor: colors.background },
  content: { padding: 22, paddingBottom: 48 },
  title: { fontFamily: fonts.sans.extrabold, fontSize: 22, color: colors.foreground, marginBottom: 16 },

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
  reviewBannerText: { flex: 1, fontSize: 12, color: colors.foreground },

  fieldLabel: { marginTop: 14 },
  fieldRow: { flexDirection: 'row', gap: 12 },

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
  serviceInput: { flex: 1, fontFamily: fonts.sans.medium, fontSize: 15, color: colors.foreground },

  suggestions: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    backgroundColor: colors.card,
    marginTop: 4,
    overflow: 'hidden',
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
  suggestionName: { flex: 1, fontFamily: fonts.sans.medium, fontSize: 14, color: colors.foreground },
  suggestionCost: { fontFamily: fontMono, fontSize: 12, color: colors.mutedForeground },

  costBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
  },
  costSymbol: { fontFamily: fontMono, fontSize: 15, color: colors.mutedForeground, marginRight: 4 },
  costInput: { flex: 1, fontFamily: fontMonoBold, fontSize: 15, color: colors.foreground },

  segmentRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  cycleSegment: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' },
  currencySegment: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.foreground },
  segmentText: { fontFamily: fonts.sans.medium, fontSize: 12, color: colors.foreground },
  segmentTextActive: { color: colors.background, fontFamily: fonts.sans.semibold },

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
  dateText: { fontFamily: fontMono, fontSize: 14, color: colors.foreground },
  dateRelative: { fontFamily: fontMono, fontSize: 11, color: colors.brandOrange },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  categoryTile: {
    width: '23.5%',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    backgroundColor: colors.card,
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  categoryTileActive: { borderColor: colors.brandOrange, backgroundColor: 'rgba(229,61,0,0.08)' },
  categoryTileText: { fontFamily: fonts.sans.medium, fontSize: 10, color: colors.mutedForeground },
  categoryTileTextActive: { color: colors.brandOrange, fontFamily: fonts.sans.semibold },

  notesInput: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    backgroundColor: colors.card,
    padding: 12,
    fontFamily: fonts.sans.regular,
    fontSize: 14,
    color: colors.foreground,
    textAlignVertical: 'top',
  },

  previewRow: { marginTop: 16, alignItems: 'center' },
  previewText: { fontFamily: fontMono, fontSize: 12, color: colors.mutedForeground },

  error: { fontFamily: fonts.sans.regular, color: colors.destructive, fontSize: 13, marginTop: 12 },

  submitButton: { marginTop: 16 },

  editActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 18,
  },
  editAction: { paddingVertical: 6 },
  cancelActionText: { fontFamily: fonts.sans.semibold, color: colors.brandOrange, fontSize: 13 },
  resumeActionText: { fontFamily: fonts.sans.semibold, color: colors.foreground, fontSize: 13 },
  deleteActionText: { fontFamily: fonts.sans.semibold, color: colors.destructive, fontSize: 13 },
});
