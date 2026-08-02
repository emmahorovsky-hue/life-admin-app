import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { addDays, addMonths, format } from 'date-fns';
import {
  DEFAULT_CURRENCY,
  SUBSCRIPTION_SUGGESTIONS,
  ServiceSuggestion,
  formatCurrency,
  parseRenewalDate,
  radius,
} from '@life-admin/shared';
import { subscriptionApi } from '../lib/subscriptions';
import { getApiErrorMessage } from '../lib/utils';
import { SetupState, SetupStep } from '../lib/onboarding';
import { SubscriptionLogo } from './SubscriptionLogo';
import { AppText, Button, GlassSheetBackground } from './ui';
import { colors, fonts, textStyles } from '../lib/theme';
import { ROW_PAD_V, SHEET_BACKDROP_OPACITY, SHEET_HANDLE, quiet } from '../lib/quiet';
import { useSheetBackHandler } from '../lib/useSheetBackHandler';

export interface FirstRunSetupSheetHandle {
  /** Open the sheet at the step/picks the persisted state remembers. */
  present: (state: SetupState) => void;
  dismiss: () => void;
}

interface Props {
  /**
   * Dismissed part-way — remember where they were so the resume row can return
   * them, and which rows already exist so resuming can't duplicate them.
   */
  onSkip: (step: SetupStep, picks: string[], created: string[]) => void;
  /**
   * The picked subscriptions are now on the server. Fires as step 3 opens, not
   * when the sheet closes, so the dashboard can mark the flow finished and
   * reload behind the still-visible confirmation.
   */
  onFiled: () => void;
}

/** Per-row edits, keyed by service name so stepping back and forth keeps them. */
interface RowEdit {
  cost: string;
  renewalDate: string;
}

const STEP_LABELS = ['Pick', 'Check', 'Filed'];
const STEP_TITLES = ['Pick what you pay for', 'Check the amounts', "That's the file open"];

/**
 * Default renewal for a monthly plan: one month out, but never further than the
 * dashboard's upcoming-renewals window. Two separate hazards, both of which
 * have to be handled (web learned the second one after review — PR #279):
 *
 * - `addMonths` clamps to the end of a short month; `setMonth` would overflow
 *   the 31st into the month after next.
 * - The dashboard only lists renewals within 30 days (`dashboardController`,
 *   `next <= thirtyDaysFromNow`) and most calendar months are 31, so an
 *   unclamped "one month" files rows that are missing from the one panel that
 *   exists to show them — and February would work, making it read as
 *   intermittent rather than wrong.
 *
 * `format` (not `toISOString`) keeps the date local, so it can't slip a day.
 */
function defaultRenewalDate(): string {
  const now = new Date();
  const oneMonth = addMonths(now, 1);
  const windowEnd = addDays(now, 30);
  return format(oneMonth < windowEnd ? oneMonth : windowEnd, 'yyyy-MM-dd');
}

// decimal-pad shows a comma key in comma-decimal locales; parseFloat("12,99")
// would silently truncate to 12. Same guard as SubscriptionFormSheet.
const parseCost = (text: string) => parseFloat(text.replace(',', '.'));

/**
 * First-run setup (LIF-224) — the mobile counterpart of the web wizard: pick
 * services → check the amounts → filed. Shown once, on an empty dashboard, and
 * never blocking: the dashboard behind it is fully usable the moment it closes,
 * and skipping leaves a resume row that remembers the step and the picks.
 *
 * A bottom sheet rather than a full-screen modal, against the design doc's 1b
 * frame: every modal surface in the app is already a sheet, and one full-screen
 * flow would be new vocabulary for the user's very first minute. It earns the
 * room back by snapping high for the two working steps and giving the height
 * back for the confirmation, and by giving the pick list its own scroll.
 *
 * Styled against "Quiet" (LIF-211/213) rather than ported from web: the chip
 * grid is hairline-separated rows, and the step strip is an eyebrow.
 */
export const FirstRunSetupSheet = forwardRef<FirstRunSetupSheetHandle, Props>(
  function FirstRunSetupSheet({ onSkip, onFiled }, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const [step, setStep] = useState<SetupStep>(1);
    const [picks, setPicks] = useState<string[]>([]);
    const [edits, setEdits] = useState<Record<string, RowEdit>>({});
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [filedCount, setFiledCount] = useState(0);
    const [defaultRenewal, setDefaultRenewal] = useState(defaultRenewalDate);
    // Android only — the row whose date picker is open (see the date control).
    const [datePickerFor, setDatePickerFor] = useState<string | null>(null);
    // Drives the Android back handler only — this sheet cannot use FormSheet's
    // chrome, so it wires back up by hand. See useSheetBackHandler.
    const [presented, setPresented] = useState(false);

    // Back is a dismissal like any other, so it goes through the sheet rather
    // than short-circuiting to `reportSkip` — `handleDismiss` below is what
    // decides whether leaving counts as a skip, and it must stay the only place
    // that decides it.
    useSheetBackHandler(
      presented,
      useCallback(() => sheetRef.current?.dismiss(), []),
    );

    // Names already created server-side. A partial failure leaves the user on
    // step 2 to retry, and without this the successful rows would be created a
    // second time — duplicate subscriptions from a single "File" press. Seeded
    // from persisted state so the guard also holds across skip → resume.
    const createdNames = useRef<Set<string>>(new Set());
    // The outcome is reported exactly once per opening: an explicit Skip and the
    // dismissal it triggers would otherwise both fire, and a drag-down has to
    // count as the same skip the button does.
    const reported = useRef(false);

    const selectHaptic = useCallback(() => {
      Haptics.selectionAsync().catch(() => {});
    }, []);

    useImperativeHandle(ref, () => ({
      present: (state) => {
        setStep(state.step);
        setPicks(state.picks);
        createdNames.current = new Set(state.created);
        setEdits({});
        setError('');
        setFiledCount(0);
        setDatePickerFor(null);
        // Recomputed per opening, not per mount: the sheet lives as long as the
        // dashboard, and a session left open overnight would otherwise file
        // yesterday's default.
        setDefaultRenewal(defaultRenewalDate());
        reported.current = false;
        setPresented(true);
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const selected = useMemo(
      () => SUBSCRIPTION_SUGGESTIONS.filter((s) => picks.includes(s.name)),
      [picks],
    );

    const rowFor = useCallback(
      (name: string): RowEdit => {
        const suggestion = SUBSCRIPTION_SUGGESTIONS.find((s) => s.name === name);
        return edits[name] ?? { cost: String(suggestion?.cost ?? 0), renewalDate: defaultRenewal };
      },
      [edits, defaultRenewal],
    );

    // Suggestion costs are all monthly (see the shared service directory), so
    // the running total is a plain sum rather than a per-cycle normalisation.
    const monthlyTotal = selected.reduce((sum, s) => {
      const parsed = parseCost(rowFor(s.name).cost);
      return sum + (Number.isFinite(parsed) ? parsed : 0);
    }, 0);

    // Mirror the server's rules (cost isFloat min 0, renewalDate isISO8601) so
    // an emptied field is caught here. Left to the server it comes back as a
    // bare "Validation failed", which says nothing about which field to fix.
    const incomplete = selected.some((s) => {
      const row = rowFor(s.name);
      const cost = parseCost(row.cost);
      return !row.renewalDate || !Number.isFinite(cost) || cost < 0;
    });

    const togglePick = (name: string) => {
      selectHaptic();
      setPicks((prev) => (prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]));
    };

    const setEdit = (name: string, patch: Partial<RowEdit>) =>
      setEdits((prev) => ({ ...prev, [name]: { ...rowFor(name), ...patch } }));

    const reportSkip = useCallback(() => {
      if (reported.current) return;
      reported.current = true;
      onSkip(step, picks, [...createdNames.current]);
    }, [onSkip, step, picks]);

    // A drag-down or backdrop tap means the same thing the buttons do. Leaving
    // from step 3 reports nothing: `onFiled` already marked the flow finished
    // as that step opened, and calling it a skip would re-offer a done flow.
    const handleDismiss = useCallback(() => {
      setPresented(false);
      if (step === 3) reported.current = true;
      else reportSkip();
    }, [step, reportSkip]);

    const fileSubscriptions = async () => {
      setSubmitting(true);
      setError('');

      const pending = selected.filter((s) => !createdNames.current.has(s.name));
      const results = await Promise.allSettled(
        pending.map((s) => {
          const row = rowFor(s.name);
          const cost = parseCost(row.cost);
          return subscriptionApi.create({
            name: s.name,
            cost: Number.isFinite(cost) ? cost : 0,
            currency: DEFAULT_CURRENCY,
            billingCycle: s.cycle,
            renewalDate: row.renewalDate,
            category: s.category,
          });
        }),
      );

      results.forEach((result, i) => {
        if (result.status === 'fulfilled') createdNames.current.add(pending[i].name);
      });

      const failures = results.filter((r) => r.status === 'rejected');
      setSubmitting(false);

      if (failures.length > 0) {
        // Stay on step 2 with every edit intact; the retry only re-sends the
        // rows that did not land. The server's own message is appended rather
        // than substituted — on its own it can be as unhelpful as "Validation
        // failed", which leaves the user unsure their edits survived.
        const detail = getApiErrorMessage((failures[0] as PromiseRejectedResult).reason, '');
        setError(
          `${failures.length} of ${pending.length} could not be saved. Your edits are kept — try again.` +
            (detail ? ` (${detail})` : ''),
        );
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setFiledCount(createdNames.current.size);
      setStep(3);
      onFiled();
    };

    const handlePrimary = () => {
      if (step === 1) setStep(2);
      else if (step === 2) void fileSubscriptions();
      else sheetRef.current?.dismiss();
    };

    const handleSkip = () => {
      reportSkip();
      sheetRef.current?.dismiss();
    };

    const primaryLabel =
      step === 1 ? 'Next — check amounts' : step === 2 ? `File ${selected.length}` : 'Go to dashboard';
    const primaryDisabled = submitting || (step === 2 && (selected.length === 0 || incomplete));
    const itemNoun = selected.length === 1 ? 'item' : 'items';

    // Steps 1 and 2 need the room — 16 pick rows, then a keyboard under a text
    // field. Step 3 is four lines of confirmation, so the sheet gives the
    // height back instead of holding an 88% sheet over the dashboard the user
    // has just populated. A step-driven snap point rather than
    // `enableDynamicSizing`: the pick list has its own scroll, and measuring a
    // fixed-height scroll container to size the sheet around it is the one case
    // dynamic sizing cannot do.
    const snapFraction = step === 3 ? 0.46 : 0.88;
    const snapPoints = useMemo(() => [`${snapFraction * 100}%`], [snapFraction]);
    // BottomSheetView sizes to its content, not to the snap point, so `flex: 1`
    // inside it resolves against the (tall, 17-row) content rather than the
    // sheet — the list never gets a bounded height to scroll within and the
    // footer is pushed below the sheet edge, out of reach. Bind the content to
    // the snap height (less the drag handle) so the list takes the leftover
    // space and scrolls, and the footer stays pinned and tappable.
    const contentHeight = snapFraction * windowHeight - HANDLE_HEIGHT;

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
        onDismiss={handleDismiss}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backgroundComponent={GlassSheetBackground}
        handleIndicatorStyle={SHEET_HANDLE}
      >
        <BottomSheetView style={[styles.container, { height: contentHeight }]}>
          {/* Step counter as an eyebrow — the web strip of bordered pills is
              exactly the ornament the card-free redesign dropped. */}
          <View style={styles.head}>
            <AppText style={quiet.eyebrow}>
              Step {step} of 3 · {STEP_LABELS[step - 1]}
            </AppText>
            {/* Brand period, matching every FormSheet title. */}
            <AppText variant="title" style={styles.title}>
              {STEP_TITLES[step - 1]}
              <Text style={styles.titleAccent}>.</Text>
            </AppText>
          </View>

          {error ? (
            <AppText variant="footnote" accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </AppText>
          ) : null}

          {step === 1 && (
            <>
              <AppText variant="footnote" style={styles.lede}>
                Tick every service you're subscribed to. Prices are the standard plan — you can
                correct them next.
              </AppText>
              {/* The list scrolls, not the sheet: 16 rows at this rhythm are
                  taller than any snap point, and dragging the sheet away while
                  reaching row 12 would be the wrong gesture. */}
              <BottomSheetScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                {SUBSCRIPTION_SUGGESTIONS.map((s) => (
                  <PickRow
                    key={s.name}
                    service={s}
                    picked={picks.includes(s.name)}
                    onToggle={() => togglePick(s.name)}
                  />
                ))}
              </BottomSheetScrollView>
            </>
          )}

          {step === 2 && (
            <>
              <AppText variant="footnote" style={styles.lede}>
                Two things per line: what it costs a month, and when it next renews. Nothing here is
                final.
              </AppText>
              {selected.length === 0 ? (
                <View style={[styles.list, styles.listContent]}>
                  <AppText style={quiet.emptyText}>
                    Nothing picked yet — step back and tick at least one.
                  </AppText>
                </View>
              ) : (
                <BottomSheetScrollView
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {selected.map((s) => (
                    <CheckRow
                      key={s.name}
                      service={s}
                      row={rowFor(s.name)}
                      editable={!submitting}
                      onCost={(cost) => setEdit(s.name, { cost })}
                      onDate={(renewalDate) => setEdit(s.name, { renewalDate })}
                      androidPickerOpen={datePickerFor === s.name}
                      onOpenAndroidPicker={() => setDatePickerFor(s.name)}
                      onCloseAndroidPicker={() => setDatePickerFor(null)}
                    />
                  ))}
                  {incomplete && (
                    <AppText variant="footnote" style={styles.hint}>
                      Every line needs an amount and a renewal date before it can be filed.
                    </AppText>
                  )}
                </BottomSheetScrollView>
              )}
            </>
          )}

          {step === 3 && (
            <View style={styles.filed} accessibilityRole="summary">
              <AppText variant="headline" style={styles.filedCount}>
                {filedCount} {filedCount === 1 ? 'subscription' : 'subscriptions'} filed
              </AppText>
              <AppText variant="footnote" style={styles.filedBody}>
                We'll flag every renewal seven days out. Add the rest whenever — Subscriptions ›
                Add.
              </AppText>
            </View>
          )}

          {/* Footer. Ordered skip → Back → total → primary so the least-wanted
              action is furthest from the thumb and the total sits directly
              above the button it describes (the same correction web made). */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            {step < 3 && (
              <View style={styles.secondaryRow}>
                <Pressable
                  onPress={handleSkip}
                  disabled={submitting}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <AppText variant="footnote" style={styles.skip}>
                    Skip setup
                  </AppText>
                </Pressable>
                {step === 2 && (
                  <Button
                    title="Back"
                    variant="outline"
                    size="sm"
                    disabled={submitting}
                    onPress={() => setStep(1)}
                  />
                )}
              </View>
            )}
            {step < 3 && (
              <View style={styles.totalRow}>
                <AppText style={quiet.eyebrow}>
                  {selected.length} {itemNoun} · per month
                </AppText>
                <AppText variant="monoData" style={styles.totalAmount}>
                  {formatCurrency(monthlyTotal, DEFAULT_CURRENCY)}
                </AppText>
              </View>
            )}
            <Button
              title={primaryLabel}
              loading={submitting}
              disabled={primaryDisabled}
              onPress={handlePrimary}
            />
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

/**
 * Step 1 row. Hairline-separated rather than a bordered chip: the card-free
 * redesign took borders out of the language, and a single column of 60pt rows
 * reads faster on a phone than a two-up grid of tiles anyway. The leading slot
 * is a square box — the logo's motif, and the same shape as the due dot.
 */
function PickRow({
  service,
  picked,
  onToggle,
}: {
  service: ServiceSuggestion;
  picked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      style={styles.pickRow}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: picked }}
      accessibilityLabel={`${service.name}, ${formatCurrency(service.cost, DEFAULT_CURRENCY)} per month`}
    >
      <View style={[styles.tick, picked && styles.tickOn]}>
        {picked && <Ionicons name="checkmark" size={13} color={colors.white} />}
      </View>
      <SubscriptionLogo name={service.name} category={service.category} size={30} />
      <View style={quiet.rowBody}>
        <AppText style={quiet.rowName} numberOfLines={1}>
          {service.name}
        </AppText>
        <AppText style={quiet.rowMeta}>
          {formatCurrency(service.cost, DEFAULT_CURRENCY)}/mo
        </AppText>
      </View>
    </Pressable>
  );
}

/**
 * Step 2 row. Both fields are `BottomSheetTextInput`/native controls, never a
 * plain `TextInput` — inside a sheet that is what keeps the keyboard from
 * covering the field being edited.
 */
function CheckRow({
  service,
  row,
  editable,
  onCost,
  onDate,
  androidPickerOpen,
  onOpenAndroidPicker,
  onCloseAndroidPicker,
}: {
  service: ServiceSuggestion;
  row: RowEdit;
  editable: boolean;
  onCost: (cost: string) => void;
  onDate: (renewalDate: string) => void;
  androidPickerOpen: boolean;
  onOpenAndroidPicker: () => void;
  onCloseAndroidPicker: () => void;
}) {
  const asDate = parseRenewalDate(row.renewalDate);
  const valid = !Number.isNaN(asDate.getTime());
  const value = valid ? asDate : new Date();

  return (
    <View style={styles.checkRow}>
      <View style={styles.checkRowTop}>
        <SubscriptionLogo name={service.name} category={service.category} size={30} />
        <AppText style={[quiet.rowName, styles.checkName]} numberOfLines={1}>
          {service.name}
        </AppText>
        <View style={styles.costBox}>
          <BottomSheetTextInput
            style={[textStyles.monoData, styles.costInput]}
            value={row.cost}
            editable={editable}
            keyboardType="decimal-pad"
            selectTextOnFocus
            placeholder="0.00"
            placeholderTextColor={colors.faint}
            onChangeText={onCost}
            accessibilityLabel={`${service.name} monthly cost`}
          />
        </View>
      </View>

      {/* iOS gets the compact picker inline — it opens its own native overlay,
          so nothing has to float above a scrolling list. Android has no compact
          mode, so the date is a button that opens the platform dialog. */}
      <View style={styles.dateSlot}>
        {Platform.OS === 'ios' ? (
          <DateTimePicker
            value={value}
            mode="date"
            display="compact"
            disabled={!editable}
            accessibilityLabel={`${service.name} renewal date`}
            onChange={(event, date) => {
              if (event.type === 'set' && date) onDate(format(date, 'yyyy-MM-dd'));
            }}
          />
        ) : (
          <>
            <Pressable
              style={styles.dateButton}
              disabled={!editable}
              onPress={onOpenAndroidPicker}
              accessibilityRole="button"
              accessibilityLabel={`${service.name} renewal date`}
            >
              <Ionicons name="calendar-outline" size={14} color={colors.mutedForeground} />
              <AppText variant="monoMeta" style={styles.dateText}>
                {format(value, 'MMM d, yyyy')}
              </AppText>
            </Pressable>
            {androidPickerOpen && (
              <DateTimePicker
                value={value}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  onCloseAndroidPicker();
                  if (event.type === 'set' && date) onDate(format(date, 'yyyy-MM-dd'));
                }}
              />
            )}
          </>
        )}
      </View>
    </View>
  );
}

const SHEET_PAD = 22;
// @gorhom's default drag-handle area, subtracted from the snap height to get the
// content height (see `contentHeight`).
const HANDLE_HEIGHT = 24;

const styles = StyleSheet.create({
  // Height is set inline to the snap height (BottomSheetView won't stretch to
  // the snap point on its own), so the list in the middle can take the leftover
  // height and scroll inside it while the footer stays pinned.
  container: {},

  head: { paddingHorizontal: SHEET_PAD, paddingTop: 4, gap: 6 },
  title: { color: colors.foreground },
  titleAccent: { color: colors.brandOrange },
  lede: {
    paddingHorizontal: SHEET_PAD,
    paddingTop: 10,
    paddingBottom: 4,
    color: colors.softMuted,
  },
  error: { paddingHorizontal: SHEET_PAD, paddingTop: 10, color: colors.destructive },
  hint: { paddingTop: ROW_PAD_V, color: colors.softMuted },

  // The list takes the height left between the header and the footer, and
  // scrolls inside it — the sheet itself stays at its snap point.
  list: { flex: 1 },
  listContent: { paddingHorizontal: SHEET_PAD, paddingBottom: 8 },

  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: ROW_PAD_V,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.rowDivider,
  },
  // Square by intent, like the due dot — the one place the sheet spends orange.
  tick: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tickOn: { backgroundColor: colors.brandOrange, borderColor: colors.brandOrange },

  checkRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.rowDivider,
  },
  checkRowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkName: { flex: 1, minWidth: 0 },
  costBox: {
    width: 92,
    height: 38,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
  },
  costInput: { color: colors.foreground, textAlign: 'right' },
  // Indented to the name column so the date reads as that row's second line.
  dateSlot: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginLeft: 42 },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dateText: { color: colors.foreground },

  filed: { flex: 1, paddingHorizontal: SHEET_PAD, paddingTop: 18, gap: 8 },
  filedCount: { color: colors.foreground },
  filedBody: { color: colors.softMuted, maxWidth: 320 },

  footer: {
    paddingHorizontal: SHEET_PAD,
    paddingTop: 14,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  secondaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skip: { color: colors.softMuted, textDecorationLine: 'underline' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalAmount: { fontFamily: fonts.mono.bold, fontSize: 16, color: colors.foreground },
});
