import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { addDays, addMonths, format } from 'date-fns';
import {
  DEFAULT_CURRENCY,
  SUBSCRIPTION_SUGGESTIONS,
  ServiceSuggestion,
  currencies,
  currencyForLocale,
  currencySymbol,
  formatCurrency,
  parseRenewalDate,
  radius,
  suggestionCost,
  supportedCurrency,
} from '@life-admin/shared';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionApi } from '../lib/subscriptions';
import { updateProfile } from '../lib/profile';
import { detectLocale } from '../lib/locale';
import { formatRetryDelay, getApiErrorMessage, getRetryAfterMs } from '../lib/utils';
import { SetupStep, useSetupState, writeSetupState } from '../lib/onboarding';
import { usePushPermission } from '../lib/usePushPermission';
import { SubscriptionLogo } from '../components/SubscriptionLogo';
import {
  AmountInput,
  AppText,
  Button,
  Dropdown,
  ScreenTitle,
  Switch,
  useToast,
} from '../components/ui';
import { IconChevron, IconCheck, IconCalendar } from '../components/icons';
import { colors, fonts } from '../lib/theme';
import { ROW_PAD_V, SCREEN_PAD, quiet } from '../lib/quiet';
import { useSheetBackHandler } from '../lib/useSheetBackHandler';

/** Per-row edits, keyed by service name so stepping back and forth keeps them. */
interface RowEdit {
  cost: string;
  renewalDate: string;
}

const STEP_LABELS = ['Pick', 'Check', 'Filed'];
/** Gutter between the two columns of step 1's grid, and between its rows. */
const TILE_GAP = 12;
const STEP_TITLES = ['Pick what you pay for', 'Check the amounts', "That's the file open"];
const CURRENCY_OPTIONS = currencies.map((code) => ({ value: code, meta: currencySymbol(code) }));

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
 * What currency to open in.
 *
 * A stored preference that isn't the schema default was set deliberately —
 * Account › Default currency is the only thing that writes one — so it outranks
 * the locale guess. Otherwise the device's region prefills, and DEFAULT_CURRENCY
 * is the floor for a locale naming no region this app has a currency for.
 *
 * Whatever this returns is shown in a control the user can change before a
 * single row is filed. That is the point: this flow decides the currency of
 * every subscription the account starts with, and the dashboard reads its
 * display currency back off that data (`dominantCurrency`), so a silent guess
 * here would set the currency of the whole app with nothing on screen saying so.
 */
function initialCurrency(preferred: string | undefined): string {
  const stored = supportedCurrency(preferred);
  if (stored && stored !== DEFAULT_CURRENCY) return stored;
  return currencyForLocale(detectLocale()) ?? DEFAULT_CURRENCY;
}

/**
 * First-run setup (LIF-224): pick services → check the amounts → filed.
 *
 * A full screen, not the bottom sheet this shipped as. The sheet was chosen
 * because every other modal surface in the app is one, but this flow is not a
 * modal task on top of the dashboard — it is the first thing a new account
 * does, three steps long, with a scrolling list of sixteen rows and a keyboard
 * on step 2. A sheet gave that 88% of the height and its own scroll inside
 * someone else's screen; a screen just gives it the screen.
 *
 * It lives at the root of the router rather than in `(app)`, so the tab bar is
 * not underneath it — a first run has one path through it, and a tab bar is an
 * invitation to leave it half-done. The route is still behind auth: there is no
 * user without a session, and this redirects out if it is somehow reached
 * without one.
 *
 * Leaving by any route other than finishing is a skip, and a skip is
 * recoverable: the step, the picks and anything already filed are persisted, and
 * the dashboard shows a resume row.
 */
export default function SetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const { state } = useSetupState(user?.id);

  const [step, setStep] = useState<SetupStep>(1);
  const [picks, setPicks] = useState<string[]>([]);
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Epoch ms before which filing cannot succeed, set from a 429's Retry-After.
  // Retrying inside that window is guaranteed to fail and costs the user another
  // request against the limit that is already refusing them.
  const [retryAt, setRetryAt] = useState(0);
  const [retryBlocked, setRetryBlocked] = useState(false);
  const [filedCount, setFiledCount] = useState(0);
  const [currency, setCurrency] = useState(() => initialCurrency(user?.defaultCurrency));
  const [currencyOpen, setCurrencyOpen] = useState(false);
  // Android only — the row whose date picker is open (see the date control).
  const [datePickerFor, setDatePickerFor] = useState<string | null>(null);
  // Which reminder channel has a write in flight, if any. Not a boolean: the two
  // channels are independent, and disabling both switches for one save implies
  // they are coupled.
  const [savingReminders, setSavingReminders] = useState<'email' | 'push' | null>(null);
  // Computed once per mount rather than per render: a screen left open overnight
  // must not file yesterday's default.
  const [defaultRenewal] = useState(defaultRenewalDate);

  // Names already created server-side. A partial failure leaves the user on
  // step 2 to retry, and without this the successful rows would be created a
  // second time — duplicate subscriptions from a single "File" press. Seeded
  // from persisted state so the guard also holds across skip → resume.
  const createdNames = useRef<Set<string>>(new Set());
  // The outcome is written exactly once: an explicit Skip and the unmount it
  // causes would otherwise both fire, and finishing must not be overwritten by
  // the unmount that follows it.
  const reported = useRef(false);
  // Seeding is one-shot. `state` resolves a tick after mount (a keychain read),
  // and re-applying it later would throw away edits made in the meantime.
  const seeded = useRef(false);

  const selectHaptic = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  // Resume where the last run left off.
  useEffect(() => {
    if (!state || seeded.current) return;
    seeded.current = true;
    setStep(state.step);
    setPicks(state.picks);
    createdNames.current = new Set(state.created);
  }, [state]);

  // Whatever is on screen when this unmounts, in a ref the cleanup below can
  // read — an effect with `[]` deps sees the mount-time values otherwise.
  const latest = useRef({ step, picks, userId: user?.id });
  useEffect(() => {
    latest.current = { step, picks, userId: user?.id };
  }, [step, picks, user?.id]);

  /**
   * Persist a skip. Called by Skip, by the hardware/gesture back that leaves the
   * flow, and by the unmount those cause — whichever gets there first wins, so
   * an exit can never be missed and can never be double-counted.
   *
   * Written straight to storage rather than through the hook's setter: by the
   * time the cleanup runs this component is going away, and the write has to
   * outlive it.
   */
  const reportSkip = useCallback(() => {
    if (reported.current) return;
    reported.current = true;
    const { step: at, picks: chosen, userId } = latest.current;
    if (!userId) return;
    void writeSetupState(userId, {
      status: 'skipped',
      step: at,
      picks: chosen,
      created: [...createdNames.current],
    });
  }, []);

  useEffect(() => reportSkip, [reportSkip]);

  // Android back on step 2 is the header's back arrow, not an exit — the two
  // must agree. Steps 1 and 3 let it fall through and pop the screen, which
  // `reportSkip` on unmount records (step 3 has already reported).
  useSheetBackHandler(
    step === 2,
    useCallback(() => setStep(1), []),
  );

  const selected = useMemo(
    () => SUBSCRIPTION_SUGGESTIONS.filter((s) => picks.includes(s.name)),
    [picks],
  );

  // Untouched rows are priced from the catalog *at the current currency*, so
  // switching currency reprices them with no reset — `edits` only ever holds
  // what the user typed, and their own numbers are left exactly as typed.
  const rowFor = useCallback(
    (name: string): RowEdit => {
      const suggestion = SUBSCRIPTION_SUGGESTIONS.find((s) => s.name === name);
      const listPrice = suggestion ? suggestionCost(suggestion, currency) : 0;
      return edits[name] ?? { cost: String(listPrice), renewalDate: defaultRenewal };
    },
    [edits, defaultRenewal, currency],
  );

  // Suggestion costs are all monthly (see the shared service directory), so the
  // running total is a plain sum rather than a per-cycle normalisation.
  const monthlyTotal = selected.reduce((sum, s) => {
    const parsed = parseCost(rowFor(s.name).cost);
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);

  // Mirror the server's rules (cost isFloat min 0, renewalDate isISO8601) so an
  // emptied field is caught here. Left to the server it comes back as a bare
  // "Validation failed", which says nothing about which field to fix.
  const incomplete = selected.some((s) => {
    const row = rowFor(s.name);
    const cost = parseCost(row.cost);
    return !row.renewalDate || !Number.isFinite(cost) || cost < 0;
  });

  // Holds the primary button down for as long as the server said to wait, then
  // releases it on its own — the user should not have to guess when the wait is
  // over, and a disabled button with no end is indistinguishable from a broken
  // one.
  //
  // The timer alone is not enough: iOS suspends the JS thread in the
  // background, so a setTimeout measures thread time, not wall-clock time. A
  // wait of up to 15 minutes is long enough that backgrounding the app during
  // it is ordinary, and the button would then stay down well past the point the
  // server would have accepted the request. So the deadline is re-checked
  // against the clock whenever the app comes back to the foreground, and the
  // timer is only the path for a user who sits and waits.
  useEffect(() => {
    if (!retryAt) return;

    const release = () => setRetryBlocked(false);
    const remaining = () => Math.max(0, retryAt - Date.now());

    if (remaining() === 0) {
      release();
      return;
    }

    setRetryBlocked(true);
    let id = setTimeout(release, remaining());

    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      clearTimeout(id);
      if (remaining() === 0) release();
      else id = setTimeout(release, remaining());
    });

    return () => {
      clearTimeout(id);
      sub.remove();
    };
  }, [retryAt]);

  const togglePick = (name: string) => {
    selectHaptic();
    // The currency menu floats over these rows, so a tap that lands on one is
    // also a dismissal of it — otherwise it stays open over the list the user
    // has gone back to reading.
    setCurrencyOpen(false);
    setPicks((prev) => (prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]));
  };

  const setEdit = (name: string, patch: Partial<RowEdit>) =>
    setEdits((prev) => ({ ...prev, [name]: { ...rowFor(name), ...patch } }));

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
          currency,
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
      // Stay on step 2 with every edit intact; the retry only re-sends the rows
      // that did not land. The server's own message is appended rather than
      // substituted — on its own it can be as unhelpful as "Validation failed",
      // which leaves the user unsure their edits survived.
      const reason = (failures[0] as PromiseRejectedResult).reason;
      const kept = `${failures.length} of ${pending.length} could not be saved. Your edits are kept`;

      // Rate limiting is the one failure where "try again" is actively wrong
      // advice: the window is minutes long, and each retry inside it spends
      // another request on the limiter that is already refusing them. Say when
      // instead, and hold the button until then.
      const retryAfterMs = getRetryAfterMs(reason);
      if (retryAfterMs !== null) {
        setRetryAt(Date.now() + retryAfterMs);
        setError(`${kept} — try again ${formatRetryDelay(retryAfterMs)}.`);
        return;
      }

      const detail = getApiErrorMessage(reason, '');
      setError(`${kept} — try again.` + (detail ? ` (${detail})` : ''));
      return;
    }

    setRetryAt(0);

    // Filing is the act that makes the currency the account's, not the flow's:
    // every row just created is denominated in it, so the add form and the other
    // platform should default to it too. Best-effort — the rows already carry
    // the right currency, and a failed preference write is not worth a stumble
    // at the end of a first run. Skipped when it already matches.
    if (currency !== user?.defaultCurrency) {
      updateProfile({ defaultCurrency: currency })
        .then((res) => updateUser(res.data.user))
        .catch(() => {});
    }

    // Marked done as step 3 opens, not as the screen closes: the dashboard is
    // behind this and reloads on focus, so it is already populated by the time
    // the user is handed back to it.
    reported.current = true;
    if (user?.id) {
      void writeSetupState(user.id, {
        status: 'done',
        step: 3,
        picks,
        created: [...createdNames.current],
      });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setFiledCount(createdNames.current.size);
    setStep(3);
  };

  /**
   * Renewal reminders, on the screen that has just given the user something to
   * be reminded about — the moment the settings mean anything. These are the
   * same two account-wide flags Settings › Notifications toggles
   * (`reminderEmailsEnabled`, `reminderPushEnabled`), read and written the same
   * way, so the two screens can never disagree.
   *
   * Both channels appear because the server sends on both and defaults both on;
   * showing only email here told the user they had opted into an inbox message
   * and then buzzed their phone. They are independent — neither is a fallback
   * for the other, so turning one off says nothing about the other.
   *
   * They read on because the server defaults them on. Shown anyway rather than
   * hidden: a reminder the user did not ask for arriving in a month's time is
   * worse than a switch they glanced at and left alone.
   *
   * The switches follow the server, not the tap — they only move once the write
   * lands, so a failure needs no rollback. Same as the settings screen.
   */
  const remindersOn = user?.reminderEmailsEnabled ?? true;
  const pushOn = user?.reminderPushEnabled ?? true;

  // Permission denied at the OS level means nothing can arrive no matter what
  // the server thinks, so the switch would be a lie. The prompt itself has
  // already happened by now — AuthContext registers for push as soon as a
  // session exists, which is before this screen opens — so this only reports a
  // decision the user has already made.
  const pushBlocked = usePushPermission() === false;

  const saveReminder = async (
    channel: 'email' | 'push',
    patch: { reminderEmailsEnabled?: boolean; reminderPushEnabled?: boolean }
  ) => {
    setSavingReminders(channel);
    try {
      const res = await updateProfile(patch);
      updateUser(res.data.user);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not change reminders. Try again in Settings.'));
    } finally {
      setSavingReminders(null);
    }
  };

  const handlePrimary = () => {
    setCurrencyOpen(false);
    if (step === 1) setStep(2);
    else if (step === 2) void fileSubscriptions();
    else router.back();
  };

  const handleSkip = () => {
    reportSkip();
    router.back();
  };

  // There is no user without a session; this only fires if the route is reached
  // some other way (a stale deep link), and sends them where the app sends
  // every logged-out visitor.
  if (!user) return <Redirect href="/(auth)/onboarding" />;

  // Two columns against a fixed gutter, measured rather than percentage-based:
  // `gap` plus `width: 48%` overflows once the gutter is counted twice.
  const tileWidth = (windowWidth - SCREEN_PAD * 2 - TILE_GAP) / 2;

  const primaryLabel =
    step === 1 ? 'Next — check amounts' : step === 2 ? `File ${selected.length}` : 'Go to Home';
  const primaryDisabled =
    submitting || (step === 2 && (selected.length === 0 || incomplete || retryBlocked));
  const itemNoun = selected.length === 1 ? 'item' : 'items';

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false, gestureEnabled: step !== 2 }} />

      {/* Top nav. Back belongs to step 2 alone: step 1 has nothing behind it in
          the flow, and step 3's rows are already filed — an arrow back to the
          amounts screen would offer to edit subscriptions that exist. Skip
          sits where the logged-out carousel puts it, so the way out of the
          first run is in the same corner both times. */}
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        {step === 2 ? (
          <Pressable
            onPress={() => {
              selectHaptic();
              setCurrencyOpen(false);
              setStep(1);
            }}
            disabled={submitting}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back to picking services"
            style={styles.navButton}
          >
            <IconChevron direction="left" size={24} color={colors.foreground} />
          </Pressable>
        ) : (
          <View style={styles.navButton} />
        )}
        {/* Skip is step 1's alone. Past that the user has picked services and is
            checking amounts — the way out is Back, and offering to throw the
            work away sits oddly next to a screen asking them to confirm it. */}
        {step === 1 ? (
          <Pressable
            onPress={handleSkip}
            disabled={submitting}
            hitSlop={12}
            accessibilityRole="button"
            style={styles.navButton}
          >
            <AppText variant="footnote" style={styles.skip}>
              Skip
            </AppText>
          </Pressable>
        ) : (
          <View style={styles.navButton} />
        )}
      </View>

      <View style={styles.head}>
        <AppText style={quiet.eyebrow}>
          Step {step} of 3 · {STEP_LABELS[step - 1]}
        </AppText>
        {/* Every list screen titles itself this way (Subscriptions, Settings):
            pageTitle weight with the brand period. A sheet had to whisper; a
            screen should say what it is. */}
        <ScreenTitle style={styles.title}>{STEP_TITLES[step - 1]}</ScreenTitle>
      </View>

      {error ? (
        <AppText variant="footnote" accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </AppText>
      ) : null}

      {step === 1 && (
        <>
          <View style={styles.ledeRow}>
            <AppText variant="footnote" style={styles.ledeText}>
              Tick every service you're subscribed to. Standard-plan prices in
            </AppText>
            {/* The currency the account is about to be denominated in, in the
                sentence that quotes the prices rather than tucked into settings
                — this is the only moment it is cheap to change. */}
            <Dropdown
              size="inline"
              value={currency}
              options={CURRENCY_OPTIONS}
              open={currencyOpen}
              disabled={submitting}
              accessibilityLabel={`Currency, ${currency}`}
              menuWidth={116}
              onToggle={() => {
                selectHaptic();
                setCurrencyOpen((v) => !v);
              }}
              onSelect={(code) => {
                selectHaptic();
                setCurrency(code);
                setCurrencyOpen(false);
              }}
            />
            <AppText variant="footnote" style={styles.ledeText}>
              — correct them next.
            </AppText>
          </View>
          <ScrollView style={styles.list} contentContainerStyle={styles.gridContent}>
            <View style={styles.grid}>
              {SUBSCRIPTION_SUGGESTIONS.map((s) => (
                <PickTile
                  key={s.name}
                  service={s}
                  currency={currency}
                  width={tileWidth}
                  picked={picks.includes(s.name)}
                  onToggle={() => togglePick(s.name)}
                />
              ))}
            </View>
          </ScrollView>
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
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            >
              {selected.map((s) => (
                <CheckRow
                  key={s.name}
                  service={s}
                  row={rowFor(s.name)}
                  currency={currency}
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
            </ScrollView>
          )}
        </>
      )}

      {/* The confirmation finally has room to breathe — no drag handle above it
          and no 46% snap point deciding how much of it fits — which is what
          makes room for the one setting that belongs here. */}
      {step === 3 && (
        <View style={styles.filed}>
          <View accessibilityRole="summary" style={styles.filedSummary}>
            <AppText variant="title" style={styles.filedCount}>
              {filedCount} {filedCount === 1 ? 'subscription' : 'subscriptions'} filed
            </AppText>
            <AppText variant="footnote" style={styles.filedBody}>
              Add the rest whenever — Subscriptions › Add.
            </AppText>
          </View>

          <View style={styles.reminderBlock}>
            {/* An eyebrow, not a third row label: with two channel rows under
                it, a heading in the same weight as the rows reads as a third
                setting rather than the name of the pair. */}
            <AppText style={quiet.eyebrow}>Renewal reminders</AppText>

            <View style={styles.reminderRow}>
              <View style={styles.reminderText}>
                <AppText style={quiet.rowName}>Email reminders</AppText>
                <AppText variant="footnote" style={styles.reminderSub}>
                  A heads-up before a subscription renews.
                </AppText>
              </View>
              {/* Only the channel actually in flight locks — greying out the
                  other implies the two settings are coupled when the whole
                  point is that they aren't. */}
              <Switch
                checked={remindersOn}
                onCheckedChange={(next) => saveReminder('email', { reminderEmailsEnabled: next })}
                disabled={savingReminders === 'email'}
              />
            </View>

            <View style={styles.reminderDivider} />

            <View style={styles.reminderRow}>
              <View style={styles.reminderText}>
                <AppText style={quiet.rowName}>Push notifications</AppText>
                <AppText variant="footnote" style={styles.reminderSub}>
                  {pushBlocked
                    ? 'Blocked in your device settings.'
                    : 'The same heads-up, on this device.'}
                </AppText>
              </View>
              {pushBlocked ? (
                <Pressable onPress={() => Linking.openSettings()} hitSlop={8}>
                  <AppText variant="footnote" weight={500} style={styles.reminderSettingsLink}>
                    Settings
                  </AppText>
                </Pressable>
              ) : (
                <Switch
                  checked={pushOn}
                  onCheckedChange={(next) => saveReminder('push', { reminderPushEnabled: next })}
                  disabled={savingReminders === 'push'}
                />
              )}
            </View>
            {/* The timing is the server's, not a preference — saying so here
                stops the flow promising a schedule it does not control. */}
            <AppText variant="footnote" style={styles.reminderNote}>
              Timing follows each billing cycle — a day before a weekly renewal, two weeks before
              an annual one. Change this any time in Settings › Notifications.
            </AppText>
          </View>
        </View>
      )}

      {/* Footer. The total sits directly above the button it describes. */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {step < 3 && (
          <View style={styles.totalRow}>
            <AppText style={quiet.eyebrow}>
              {selected.length} {itemNoun} · per month
            </AppText>
            <AppText variant="monoData" style={styles.totalAmount}>
              {formatCurrency(monthlyTotal, currency)}
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
    </KeyboardAvoidingView>
  );
}

/**
 * Step 1 tile. Two-up rather than a single column of rows: picking is scanning,
 * not reading, and a grid puts twice as many logos in view — the logo is what
 * the eye actually matches against, and sixteen of them stacked one per line
 * turns a glance into a scroll.
 *
 * Selection is the square corner tick, the same motif as the due dot and the
 * logo mark, sitting *in* the corner (the border passes behind it) so a picked
 * tile reads as stamped rather than as merely tinted — the tint alone is too
 * quiet at this size.
 */
function PickTile({
  service,
  currency,
  width,
  picked,
  onToggle,
}: {
  service: ServiceSuggestion;
  currency: string;
  width: number;
  picked: boolean;
  onToggle: () => void;
}) {
  const price = formatCurrency(suggestionCost(service, currency), currency);
  return (
    <Pressable
      style={[styles.tile, { width }, picked && styles.tileOn]}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: picked }}
      accessibilityLabel={`${service.name}, ${price} per month`}
    >
      <SubscriptionLogo name={service.name} category={service.category} size={32} />
      <View style={styles.tileText}>
        {/* Two lines: "Adobe Creative Cloud" is the longest name in the
            directory and truncating it to "Adobe Creative…" hides which of
            Adobe's several subscriptions this is. Tiles on a row stretch to the
            tallest, so the grid stays square. */}
        <AppText style={quiet.rowName} numberOfLines={2}>
          {service.name}
        </AppText>
        <AppText style={quiet.rowMeta} numberOfLines={1}>
          {price}/mo
        </AppText>
      </View>
      {picked && (
        <View style={styles.tileTick}>
          <IconCheck size={12} color={colors.white} ink="inherit" />
        </View>
      )}
    </Pressable>
  );
}

/** Step 2 row: the amount and the renewal date, per picked service. */
function CheckRow({
  service,
  row,
  currency,
  editable,
  onCost,
  onDate,
  androidPickerOpen,
  onOpenAndroidPicker,
  onCloseAndroidPicker,
}: {
  service: ServiceSuggestion;
  row: RowEdit;
  currency: string;
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
        {/* The same field the add/edit sheet uses for an amount — this asks the
            identical question, and the answer the user types here is the one
            they will edit there. */}
        <AmountInput
          size="sm"
          containerStyle={styles.costBox}
          currency={currency}
          value={row.cost}
          editable={editable}
          selectTextOnFocus
          onChangeText={onCost}
          accessibilityLabel={`${service.name} monthly cost in ${currency}`}
        />
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
            // The compact picker draws at the system body size, which is bigger
            // than anything else in the row — the date ends up shouting louder
            // than the service it belongs to. There is no font prop on a native
            // control, so scale the whole pill from its left edge, keeping it
            // aligned to the name column above it.
            style={styles.datePicker}
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
              <IconCalendar size={14} color={colors.mutedForeground} />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  // Fixed height so the title below sits at the same y on every step — the back
  // arrow appearing and disappearing must not move the heading.
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PAD - 8,
    height: 44,
  },
  navButton: { minWidth: 44, height: 32, justifyContent: 'center', paddingHorizontal: 8 },
  skip: { color: colors.softMuted, textAlign: 'right' },

  // The nav is a fixed 44 above this, so the padding is what separates the back
  // arrow from the step label — at 14 they read as one stacked block.
  head: { paddingHorizontal: SCREEN_PAD, paddingTop: 30, gap: 8 },
  title: { color: colors.foreground },

  lede: {
    paddingHorizontal: SCREEN_PAD,
    paddingTop: 10,
    paddingBottom: 4,
    color: colors.softMuted,
  },
  // Step 1's lede wraps around the currency trigger, so the padding moves to the
  // row and the fragments carry none. zIndex so the open menu floats over the
  // pick list rather than under it.
  ledeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 5,
    rowGap: 8,
    paddingHorizontal: SCREEN_PAD,
    paddingTop: 10,
    paddingBottom: 4,
    zIndex: 20,
  },
  ledeText: { color: colors.softMuted },
  error: { paddingHorizontal: SCREEN_PAD, paddingTop: 10, color: colors.destructive },
  hint: { paddingTop: ROW_PAD_V, color: colors.softMuted },

  // The list takes the height left between the header and the footer, and
  // scrolls inside it.
  list: { flex: 1 },
  listContent: { paddingHorizontal: SCREEN_PAD, paddingBottom: 8 },
  gridContent: { paddingHorizontal: SCREEN_PAD, paddingTop: 4, paddingBottom: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP },
  tile: {
    minHeight: 100,
    justifyContent: 'space-between',
    gap: 10,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.base,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  // Picked: a full-weight orange edge and the faintest wash. The tick does the
  // shouting, so the fill stays under 10% — sixteen tinted tiles would be loud.
  tileOn: { borderWidth: 1, borderColor: colors.brandOrange, backgroundColor: 'rgba(229,61,0,0.06)' },
  tileText: { gap: 1 },
  // Square, flush into the corner — the one place this screen spends orange.
  tileTick: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandOrange,
  },

  checkRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.rowDivider,
  },
  checkRowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkName: { flex: 1, minWidth: 0 },
  // Only the width is set here; the field's own height, border and type are
  // ui/AmountInput's, so this row and the add/edit sheet cannot drift apart.
  costBox: { width: 104 },
  // Indented to the name column so the date reads as that row's second line.
  dateSlot: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginLeft: 42 },
  datePicker: { transform: [{ scale: 0.85 }], transformOrigin: 'left center' },
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

  // Sits under the title like every other step's content rather than floating
  // in the middle of the screen: centring it left a hole between the heading and
  // the sentence that reads as something failing to load.
  filed: { flex: 1, paddingHorizontal: SCREEN_PAD, paddingTop: 22, gap: 10 },
  filedSummary: { gap: 10 },
  filedCount: { color: colors.foreground },
  filedBody: { color: colors.softMuted, maxWidth: 320 },

  // Hairline-separated rather than carded: this screen has no cards, and the
  // rule reads as "and one more thing" without boxing it off.
  reminderBlock: {
    marginTop: 28,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    gap: 12,
  },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  reminderText: { flex: 1, minWidth: 0, gap: 2 },
  reminderSub: { color: colors.softMuted },
  reminderDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
  reminderSettingsLink: { color: colors.brandOrange },
  reminderNote: { color: colors.mutedForeground, lineHeight: 18 },

  footer: {
    paddingHorizontal: SCREEN_PAD,
    paddingTop: 14,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalAmount: { fontFamily: fonts.mono.bold, fontSize: 16, color: colors.foreground },
});
