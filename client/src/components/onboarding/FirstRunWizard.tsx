import { Fragment, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { AppDialog } from '@/components/ui/AppDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PaperSheet } from '@/components/PaperSheet';
import { PayprMark } from '@/components/PayprMark';
import { SubscriptionLogo } from '@/components/SubscriptionLogo';
import { SUBSCRIPTION_SUGGESTIONS } from '@/components/subscription-modal/suggestions';
import { subscriptionApi } from '@/lib/subscriptions';
import { formatCurrency, DEFAULT_CURRENCY } from '@/lib/currency';
import { getApiErrorMessage, cn } from '@/lib/utils';
import type { OnboardingStep } from '@/lib/onboarding';

interface FirstRunWizardProps {
  open: boolean;
  initialStep: OnboardingStep;
  initialPicks: string[];
  /** Dismissed part-way — remember where they were so the resume card can return them. */
  onSkip: (step: OnboardingStep, picks: string[]) => void;
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

const STEP_META = [
  { n: 1 as const, pill: 'Pick', title: 'Pick what you pay for' },
  { n: 2 as const, pill: 'Check', title: 'Check the amounts' },
  { n: 3 as const, pill: 'Filed', title: "That's the file open" },
];

/** ISO date one month out — the sensible default renewal for a monthly plan. */
function oneMonthFromToday(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
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
  onSkip,
  onFiled,
  onComplete,
}: FirstRunWizardProps) {
  const [step, setStep] = useState<OnboardingStep>(initialStep);
  const [picks, setPicks] = useState<string[]>(initialPicks);
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [filedCount, setFiledCount] = useState(0);

  // Names already created server-side. A partial failure leaves the user on
  // step 2 to retry, and without this the successful rows would be created a
  // second time — duplicate subscriptions from a single "File" press.
  const createdNames = useRef<Set<string>>(new Set());
  // Computed once per mount via a state initialiser rather than a ref, so it can
  // be read during render (a ref cannot) while staying stable across re-renders.
  const [defaultRenewal] = useState(oneMonthFromToday);

  const selected = useMemo(
    () => SUBSCRIPTION_SUGGESTIONS.filter((s) => picks.includes(s.name)),
    [picks]
  );

  const rowFor = (name: string): RowEdit => {
    const suggestion = SUBSCRIPTION_SUGGESTIONS.find((s) => s.name === name);
    return (
      edits[name] ?? {
        cost: String(suggestion?.cost ?? 0),
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
          currency: DEFAULT_CURRENCY,
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
      // that did not make it.
      setError(
        getApiErrorMessage(
          (failures[0] as PromiseRejectedResult).reason,
          `${failures.length} of ${pending.length} could not be saved. Your edits are kept — try again.`
        )
      );
      return;
    }

    const count = createdNames.current.size;
    setFiledCount(count);
    setStep(3);
    onFiled(count);
  };

  const handleClose = () => {
    // Once the rows are filed the work is done, so dismissing from step 3 is a
    // completion, not a skip — anything else would re-offer a finished flow.
    if (step === 3) onComplete(filedCount);
    else onSkip(step, picks);
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

  const primaryDisabled = submitting || (step === 2 && selected.length === 0);

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
        <div className="flex w-full flex-col gap-3">
          {/* Running total — mobile only; on desktop the step 2 sheet carries it. */}
          {step < 3 && (
            <div className="flex items-baseline gap-2 md:hidden">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {selected.length} {itemNoun} · per month
              </span>
              <span aria-hidden="true" className="leader-dots mb-0.5 flex-1" />
              <span className="font-mono text-sm font-bold">
                {formatCurrency(monthlyTotal, DEFAULT_CURRENCY)}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3 max-md:flex-col-reverse max-md:items-stretch">
            {step < 3 && (
              <button
                type="button"
                onClick={() => onSkip(step, picks)}
                className="rounded-[2px] text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 max-md:h-11"
              >
                Skip setup
              </button>
            )}
            <div className="flex flex-1 justify-end gap-2 max-md:flex-col">
              {step < 3 && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={step === 1 || submitting}
                  onClick={() => setStep(1)}
                  className="max-md:h-11 max-md:w-full"
                >
                  Back
                </Button>
              )}
              <Button
                type="button"
                onClick={handlePrimary}
                disabled={primaryDisabled}
                className="max-md:h-11 max-md:w-full"
              >
                {submitting ? 'Filing…' : primaryLabel}
              </Button>
            </div>
          </div>
        </div>
      }
    >
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {step === 1 && (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Tick every service you're subscribed to. Prices are the standard plan — you can
            correct them in the next step.
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
                      {formatCurrency(s.cost, DEFAULT_CURRENCY)}/mo
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
                      <Input
                        aria-label={`${s.name} monthly cost`}
                        inputMode="decimal"
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
                  {formatCurrency(monthlyTotal, DEFAULT_CURRENCY)}
                </span>
              </div>
            </PaperSheet>
          )}
        </>
      )}

      {step === 3 && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
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
            We'll flag every renewal seven days out. Add the rest whenever — Subscriptions › Add.
          </p>
        </div>
      )}
    </AppDialog>
  );
}
