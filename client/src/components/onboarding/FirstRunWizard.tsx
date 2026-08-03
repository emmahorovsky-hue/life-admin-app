import { Fragment, useMemo, useRef, useState } from 'react';
import { addDays, addMonths, format } from 'date-fns';
import { Check } from 'lucide-react';
import { AppDialog } from '@/components/ui/AppDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PaperSheet } from '@/components/PaperSheet';
import { PayprMark } from '@/components/PayprMark';
import { SubscriptionLogo } from '@/components/SubscriptionLogo';
import { Switch } from '@/components/ui/switch';
import { SUBSCRIPTION_SUGGESTIONS, currencies, suggestionCost } from '@life-admin/shared';
import { useAuth } from '@/contexts/AuthContext';
import { subscriptionApi } from '@/lib/subscriptions';
import { updateProfile } from '@/lib/api';
import {
  formatCurrency,
  currencyForLocale,
  currencySymbol,
  supportedCurrency,
  DEFAULT_CURRENCY,
} from '@/lib/currency';
import { getApiErrorMessage, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { OnboardingStep } from '@/lib/onboarding';

interface FirstRunWizardProps {
  open: boolean;
  initialStep: OnboardingStep;
  initialPicks: string[];
  /**
   * Names a previous run already created server-side. Seeds the dedupe so a
   * resumed wizard re-sends only what never landed.
   */
  initialCreated?: string[];
  /**
   * Dismissed part-way — remember where they were so the resume card can return
   * them, and which rows already exist so resuming can't duplicate them.
   */
  onSkip: (step: OnboardingStep, picks: string[], created: string[]) => void;
  /**
   * `count` subscriptions were just created server-side. Fires as step 3 opens,
   * separately from {@link onComplete}, so the dashboard can mark the flow done
   * and refetch behind the still-visible "Filed" screen.
   */
  onFiled: (count: number) => void;
  /** The user dismissed the finished wizard — close it. */
  onComplete: (count: number) => void;
}

/** Per-row edits, keyed by service name so stepping back and forth keeps them. */
interface RowEdit {
  cost: string;
  renewalDate: string;
}

/**
 * What currency to open in.
 *
 * A stored preference that isn't the schema default was set deliberately —
 * Settings › Appearance is the only thing that writes one — so it outranks the
 * browser's locale. Otherwise the locale prefills, and DEFAULT_CURRENCY is the
 * floor for a locale naming no region this app has a currency for.
 *
 * Only ever a prefill: the control below is visible and changeable before a row
 * is filed, because this flow decides the currency of every subscription the
 * account starts with and the dashboard reads its display currency back off
 * that data. Mirrors mobile's setup screen (mobile/app/setup.tsx).
 */
function initialCurrency(preferred: string | undefined): string {
  const stored = supportedCurrency(preferred);
  if (stored && stored !== DEFAULT_CURRENCY) return stored;
  return currencyForLocale(navigator.language) ?? DEFAULT_CURRENCY;
}

const STEP_META = [
  { n: 1 as const, pill: 'Pick', title: 'Pick what you pay for' },
  { n: 2 as const, pill: 'Check', title: 'Check the amounts' },
  { n: 3 as const, pill: 'Filed', title: "That's the file open" },
];

/**
 * Default renewal for a monthly plan: one month out, but never further than the
 * dashboard's upcoming-renewals window.
 *
 * Two separate hazards, both of which have to be handled:
 *
 * - `addMonths` clamps to the end of a short month; `setMonth` would overflow
 *   the 31st into the month after next.
 * - The dashboard only lists renewals within 30 days (`dashboardController`,
 *   `next <= thirtyDaysFromNow`) and most calendar months are 31, so an
 *   unclamped "one month" files rows that are missing from the one panel that
 *   exists to show them — and February would work, making it read as
 *   intermittent rather than wrong.
 *
 * Clamping to the window keeps the end of the flow consistent: what you just
 * filed is what you then see. `format` (not `toISOString`) keeps the date in
 * local time, so it can't slip a day west of UTC.
 */
function defaultRenewalDate(): string {
  const now = new Date();
  const oneMonth = addMonths(now, 1);
  const windowEnd = addDays(now, 30);
  return format(oneMonth < windowEnd ? oneMonth : windowEnd, 'yyyy-MM-dd');
}

/**
 * First-run setup wizard (LIF-220, design 1b): pick services → check the
 * amounts → filed. Shown once, on an empty dashboard, and never blocking — the
 * dashboard behind it is fully usable the moment this is dismissed.
 */
export function FirstRunWizard({
  open,
  initialStep,
  initialPicks,
  initialCreated = [],
  onSkip,
  onFiled,
  onComplete,
}: FirstRunWizardProps) {
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState<OnboardingStep>(initialStep);
  const [picks, setPicks] = useState<string[]>(initialPicks);
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [filedCount, setFiledCount] = useState(0);
  const [savingReminders, setSavingReminders] = useState(false);
  // Computed once per mount, like `defaultRenewal` below: the wizard is short
  // and re-deriving it under the user mid-flow would move prices they are
  // reading. See `initialCurrency` for why the browser's locale only prefills.
  const [currency, setCurrency] = useState(() => initialCurrency(user?.defaultCurrency));

  // Names already created server-side. A partial failure leaves the user on
  // step 2 to retry, and without this the successful rows would be created a
  // second time — duplicate subscriptions from a single "File" press. Seeded
  // from persisted state so the guard also holds across skip → resume, where
  // the wizard unmounts and a fresh ref would have forgotten them.
  const createdNames = useRef<Set<string>>(new Set(initialCreated));
  // Computed once per mount via a state initialiser rather than a ref, so it can
  // be read during render (a ref cannot) while staying stable across re-renders.
  const [defaultRenewal] = useState(defaultRenewalDate);

  const selected = useMemo(
    () => SUBSCRIPTION_SUGGESTIONS.filter((s) => picks.includes(s.name)),
    [picks]
  );

  // Untouched rows are priced from the catalog *at the current currency*, so
  // switching currency reprices them with no reset — `edits` only ever holds
  // what the user typed, and their own numbers are left exactly as typed.
  const rowFor = (name: string): RowEdit => {
    const suggestion = SUBSCRIPTION_SUGGESTIONS.find((s) => s.name === name);
    return (
      edits[name] ?? {
        cost: String(suggestion ? suggestionCost(suggestion, currency) : 0),
        renewalDate: defaultRenewal,
      }
    );
  };

  // Suggestion costs are all monthly (see suggestions.ts), so the running total
  // is a plain sum rather than a per-cycle normalisation.
  const monthlyTotal = selected.reduce((sum, s) => {
    const parsed = parseFloat(rowFor(s.name).cost);
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);

  // Mirror the server's rules (cost isFloat min 0, renewalDate isISO8601) so an
  // emptied field is caught here. Left to the server it comes back as a bare
  // "Validation failed", which tells the user nothing about which field to fix.
  const incompleteRows = selected.filter((s) => {
    const row = rowFor(s.name);
    const cost = parseFloat(row.cost);
    return !row.renewalDate || !Number.isFinite(cost) || cost < 0;
  });

  const togglePick = (name: string) =>
    setPicks((prev) => (prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]));

  const setEdit = (name: string, patch: Partial<RowEdit>) =>
    setEdits((prev) => ({ ...prev, [name]: { ...rowFor(name), ...patch } }));

  const fileSubscriptions = async () => {
    setSubmitting(true);
    setError('');

    const pending = selected.filter((s) => !createdNames.current.has(s.name));
    const results = await Promise.allSettled(
      pending.map((s) => {
        const row = rowFor(s.name);
        const cost = parseFloat(row.cost);
        return subscriptionApi.create({
          name: s.name,
          cost: Number.isFinite(cost) ? cost : 0,
          currency,
          billingCycle: s.cycle,
          renewalDate: row.renewalDate,
          category: s.category,
        });
      })
    );

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') createdNames.current.add(pending[i].name);
    });

    const failures = results.filter((r) => r.status === 'rejected');
    setSubmitting(false);

    if (failures.length > 0) {
      // Stay on step 2 with every edit intact; the retry only re-sends the rows
      // that did not make it. The server's own message is appended rather than
      // substituted — on its own it can be as unhelpful as "Validation failed",
      // which leaves the user with no idea that their edits survived.
      const detail = getApiErrorMessage((failures[0] as PromiseRejectedResult).reason, '');
      setError(
        `${failures.length} of ${pending.length} could not be saved. Your edits are kept — try again.` +
          (detail ? ` (${detail})` : '')
      );
      return;
    }

    // Filing is the act that makes the currency the account's, not the flow's:
    // every row just created is denominated in it, so the add dialog and the
    // phone should default to it too. Best-effort — the rows already carry the
    // right currency, and a failed preference write is not worth a stumble at
    // the end of a first run. Skipped when it already matches.
    if (currency !== user?.defaultCurrency) {
      updateProfile({ defaultCurrency: currency })
        .then((response) => updateUser(response.data.user))
        .catch(() => {
          // Ignored on purpose — see above.
        });
    }

    const count = createdNames.current.size;
    setFiledCount(count);
    setStep(3);
    onFiled(count);
  };

  /**
   * Renewal reminders, on the screen that has just given the user something to
   * be reminded about — the moment the setting means anything. It is the same
   * account-wide flag Settings › Notifications toggles, read and written the
   * same way, so the two can never disagree. Mirrors mobile's setup step 3.
   *
   * It reads on because the server defaults it on. Shown anyway rather than
   * hidden: a reminder the user did not ask for arriving in their inbox in a
   * month's time is worse than a switch they glanced at and left alone.
   *
   * The switch follows the server, not the click — it only moves once the write
   * lands, so a failure needs no rollback.
   */
  const remindersOn = user?.reminderEmailsEnabled ?? true;

  const toggleReminders = async (next: boolean) => {
    setSavingReminders(true);
    try {
      const response = await updateProfile({ reminderEmailsEnabled: next });
      updateUser(response.data.user);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not change reminders. Try again in Settings.'));
    } finally {
      setSavingReminders(false);
    }
  };

  const skipNow = () => onSkip(step, picks, [...createdNames.current]);

  const handleClose = () => {
    // Once the rows are filed the work is done, so dismissing from step 3 is a
    // completion, not a skip — anything else would re-offer a finished flow.
    if (step === 3) onComplete(filedCount);
    else skipNow();
  };

  const handlePrimary = () => {
    if (step === 1) setStep(2);
    else if (step === 2) void fileSubscriptions();
    else onComplete(filedCount);
  };

  const primaryLabel =
    step === 1
      ? 'Next — check amounts'
      : step === 2
        ? `File ${selected.length}`
        : 'Go to dashboard';

  const primaryDisabled =
    submitting || (step === 2 && (selected.length === 0 || incompleteRows.length > 0));

  const itemNoun = selected.length === 1 ? 'item' : 'items';

  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
      eyebrow={`Set up · Step ${step} of 3`}
      title={STEP_META[step - 1].title}
      className="max-w-[620px] max-md:flex max-md:h-[100dvh] max-md:w-full max-md:max-w-none max-md:flex-col max-md:rounded-none"
      bodyClassName="max-md:flex-1 max-md:overflow-y-auto"
      footerClassName="max-md:flex-col max-md:items-stretch"
      subheader={
        <div className="flex shrink-0 items-center gap-2 px-6 pb-4">
          {STEP_META.map((meta, i) => (
            <Fragment key={meta.n}>
              {i > 0 && <span aria-hidden="true" className="w-4 border-t-[1.5px] border-dashed border-border" />}
              <span
                className={cn(
                  'font-mono text-[10.5px] uppercase tracking-[0.14em] px-2 py-1 rounded-[2px] border',
                  meta.n === step
                    ? 'border-[1.5px] border-brand-orange bg-brand-orange/[0.06] text-brand-orange'
                    : 'border-border text-muted-foreground'
                )}
              >
                {meta.n} {meta.pill}
              </span>
            </Fragment>
          ))}
        </div>
      }
      footer={
        /*
          Desktop is one row: skip on the left, Back + primary on the right.
          Stacked on mobile the same DOM would put the primary mid-column and
          leave `Skip setup` closest to the thumb — the least-wanted action in
          the easiest place to hit — so the order is reassigned: skip, Back,
          running total, primary. That also puts the total directly above the
          button it describes. `contents` dissolves the desktop grouping box on
          mobile so all four can be ordered against the outer column.
        */
        <div className="flex w-full flex-col gap-3 md:flex-row md:items-center">
          {step < 3 && (
            <button
              type="button"
              onClick={skipNow}
              className="order-1 rounded-[2px] text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:order-none"
            >
              Skip setup
            </button>
          )}
          <div className="flex gap-2 max-md:contents md:flex-1 md:justify-end">
            {step < 3 && (
              <Button
                type="button"
                variant="outline"
                disabled={step === 1 || submitting}
                onClick={() => setStep(1)}
                className="order-2 max-md:h-11 md:order-none"
              >
                Back
              </Button>
            )}
            {/* Running total — mobile only; on desktop the step 2 sheet carries it. */}
            {step < 3 && (
              <div className="order-3 flex items-baseline gap-2 md:hidden">
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  {selected.length} {itemNoun} · per month
                </span>
                <span aria-hidden="true" className="leader-dots mb-0.5 flex-1" />
                <span className="font-mono text-sm font-bold">
                  {formatCurrency(monthlyTotal, currency)}
                </span>
              </div>
            )}
            <Button
              type="button"
              onClick={handlePrimary}
              disabled={primaryDisabled}
              className="order-4 max-md:h-11 md:order-none"
            >
              {submitting ? 'Filing…' : primaryLabel}
            </Button>
          </div>
        </div>
      }
    >
      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      )}

      {step === 1 && (
        <>
          <p className="mb-4 flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm text-muted-foreground">
            <span>Tick every service you're subscribed to. Standard-plan prices in</span>
            {/* The currency the account is about to be denominated in, in the
                sentence that quotes the prices rather than tucked into settings
                — this is the only moment it is cheap to change. A native select
                so the keyboard and screen-reader behaviour come for free. */}
            <span className="relative inline-flex items-center">
              <select
                aria-label="Currency for these prices"
                value={currency}
                disabled={submitting}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-7 rounded-[2px] border border-border bg-background px-2 py-0 font-mono text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {currencies.map((code) => (
                  <option key={code} value={code}>
                    {code} {currencySymbol(code)}
                  </option>
                ))}
              </select>
            </span>
            <span>— you can correct them in the next step.</span>
          </p>
          <div className="grid grid-cols-2 gap-2 md:max-h-[300px] md:overflow-y-auto max-md:grid-cols-1">
            {SUBSCRIPTION_SUGGESTIONS.map((s) => {
              const isOn = picks.includes(s.name);
              return (
                <button
                  key={s.name}
                  type="button"
                  aria-pressed={isOn}
                  onClick={() => togglePick(s.name)}
                  className={cn(
                    'relative flex items-center gap-3 rounded-[2px] border p-3 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    'max-md:min-h-[56px]',
                    isOn
                      ? 'border-brand-orange ring-2 ring-brand-orange bg-brand-orange/[0.06]'
                      : 'border-border hover:border-foreground/40'
                  )}
                >
                  <SubscriptionLogo name={s.name} category={s.category} size={30} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-bold leading-tight">{s.name}</span>
                    <span className="block font-mono text-xs text-muted-foreground">
                      {formatCurrency(suggestionCost(s, currency), currency)}/mo
                    </span>
                  </span>
                  {isOn && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-px -top-px flex h-[18px] w-[18px] items-center justify-center bg-brand-orange text-white"
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Two things to confirm per line: what it costs a month, and when it next renews.
            Nothing here is final.
          </p>
          {selected.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing picked yet — step back and tick at least one.
            </p>
          ) : (
            <PaperSheet className="pb-5 pl-10 pr-5 pt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Item
                </span>
                <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Monthly · Renews
                </span>
              </div>
              <div className="border-perf mb-4" />

              <div className="space-y-3">
                {selected.map((s) => {
                  const row = rowFor(s.name);
                  return (
                    <div key={s.name} className="flex flex-wrap items-center gap-2">
                      <SubscriptionLogo name={s.name} category={s.category} size={28} />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">{s.name}</span>
                      {/* type=number, matching the subscription modal: a free
                          text field lets a comma-decimal locale type "18,50",
                          which parseFloat silently truncates to 18. */}
                      <Input
                        aria-label={`${s.name} monthly cost`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.cost}
                        onChange={(e) => setEdit(s.name, { cost: e.target.value })}
                        className="h-9 w-[92px] rounded-[2px] font-mono text-sm"
                      />
                      <Input
                        aria-label={`${s.name} renewal date`}
                        type="date"
                        value={row.renewalDate}
                        onChange={(e) => setEdit(s.name, { renewalDate: e.target.value })}
                        className="h-9 w-[150px] rounded-[2px] font-mono text-sm max-md:flex-1"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="mb-3 mt-4 h-px bg-foreground" />
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Monthly total
                </span>
                <span className="font-mono text-2xl font-bold">
                  {formatCurrency(monthlyTotal, currency)}
                </span>
              </div>
            </PaperSheet>
          )}
          {incompleteRows.length > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              Every line needs an amount and a renewal date before it can be filed.
            </p>
          )}
        </>
      )}

      {step === 3 && (
        <div role="status" className="flex flex-col items-center gap-4 py-6 text-center">
          <PayprMark size={44} />
          <span
            className="border-2 border-brand-orange px-3 py-1 font-mono text-xs uppercase tracking-widest text-brand-orange"
            style={{ transform: 'rotate(-4deg)' }}
          >
            Filed
          </span>
          <h3 className="text-lg font-extrabold">
            {filedCount} {filedCount === 1 ? 'subscription' : 'subscriptions'} filed
          </h3>
          <p className="max-w-[38ch] text-sm text-muted-foreground">
            Add the rest whenever — Subscriptions › Add.
          </p>

          {/* Left-aligned inside a centred column: a switch and its label are a
              control, not a sentence, and centring them makes the label read as
              part of the confirmation copy above. */}
          <div className="mt-2 w-full max-w-[42ch] border-t border-border pt-5 text-left">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <label htmlFor="setup-renewal-reminders" className="text-sm font-bold">
                  Renewal reminders
                </label>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  An email before each subscription renews.
                </p>
              </div>
              <Switch
                id="setup-renewal-reminders"
                checked={remindersOn}
                onCheckedChange={toggleReminders}
                disabled={savingReminders}
              />
            </div>
            {/* The timing is the server's, not a preference — saying so here
                stops the flow promising a schedule it does not control. */}
            <p className="mt-3 text-sm text-muted-foreground">
              Timing follows each billing cycle — a day before a weekly renewal, two weeks before
              an annual one. Change this any time in Settings › Notifications.
            </p>
          </div>
        </div>
      )}
    </AppDialog>
  );
}
