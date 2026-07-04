import { ReactNode, useState } from 'react';
import { X } from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
import {
  normalizeToMonthlyCost,
  currencySymbol,
  relativeDaysSigned,
  parseRenewalDate,
} from '@life-admin/shared';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SubscriptionLogo } from '@/components/SubscriptionLogo';
import { categoryIconFor } from '@/lib/subscriptionLogo';
import { categories, currencies, SubscriptionFormValues } from '@/lib/subscriptions';
import { filterSuggestions, ServiceSuggestion } from './suggestions';

export type SubscriptionModalMode = 'add' | 'edit';
export type EditStatus = 'active' | 'cancelling' | 'ended';

/**
 * className for the shadcn <DialogContent> that hosts this two-pane modal.
 * Below 720px (same breakpoint as the pane stack) it's a full-screen sheet:
 * fills the viewport with square corners so it sits flush to the edges. At
 * ≥720px it becomes the centered floating card — widens to 800px, caps at
 * 90dvh, rounds the corners, and gets the warm shadow (a one-off value — not
 * a design-system token). `max-w-none` overrides the base `max-w-lg` so the
 * mobile sheet fills the width on tablets too. Padding is dropped and panes
 * clipped in both layouts.
 */
export const SUBSCRIPTION_MODAL_CONTENT_CLASS =
  'h-dvh w-full max-w-none rounded-none overflow-y-auto overflow-x-hidden p-0 shadow-[0_26px_58px_rgba(73,60,74,.32),0_6px_16px_rgba(40,33,20,.10)] min-[720px]:h-auto min-[720px]:max-h-[90dvh] min-[720px]:max-w-[800px] min-[720px]:rounded-lg';

export interface SubscriptionModalProps {
  mode: SubscriptionModalMode;
  title: string;
  values: SubscriptionFormValues;
  onChange: (values: SubscriptionFormValues) => void;
  /** Fired by the primary submit button (create in add mode, update in edit mode). */
  onSubmit: () => void;
  /** Fired by the header X (and used by the wrappers to close the Dialog). */
  onDismiss: () => void;
  loading?: boolean;
  error?: string;
  /** Transient "Saved ✓" success state on the primary button. */
  saved?: boolean;
  submitLabel?: string;
  /** Extra banner under the header (e.g. review flow's non-subscription warning). */
  banner?: ReactNode;
  /** Per-field hint node (e.g. review flow's AI "please confirm" note). */
  hint?: (field: keyof SubscriptionFormValues) => ReactNode;
  // ── edit-mode destructive actions (all optional; wired by EditSubscriptionDialog) ──
  editStatus?: EditStatus;
  onCancelRenewal?: () => void;
  onResume?: () => void;
  onDelete?: () => void;
}

// Segmented billing control — 4 canonical cycles. Legacy 'annual' maps to 'yearly'.
const CYCLE_SEGMENTS: { id: string; label: string }[] = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' },
];
const CYCLE_LABEL: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  annual: 'Yearly',
};
const EVERY_LABEL: Record<string, string> = {
  weekly: 'EVERY WEEK',
  monthly: 'EVERY MONTH',
  quarterly: 'EVERY QUARTER',
  yearly: 'EVERY YEAR',
  annual: 'EVERY YEAR',
};

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  );
}

function ReceiptRow({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="flex items-end gap-1">
      <span
        className={cn(
          'font-mono uppercase text-muted-foreground',
          small ? 'text-[10px]' : 'text-[11px]'
        )}
      >
        {label}
      </span>
      <span className="leader-dots mb-[3px] flex-1" />
      <span
        className={cn(
          'font-mono font-bold tabular-nums text-foreground',
          small ? 'text-[11px]' : 'text-[13px]'
        )}
      >
        {value}
      </span>
    </div>
  );
}

export default function SubscriptionModal({
  mode,
  title,
  values,
  onChange,
  onSubmit,
  onDismiss,
  loading = false,
  error,
  saved = false,
  submitLabel,
  banner,
  hint,
  editStatus = 'active',
  onCancelRenewal,
  onResume,
  onDelete,
}: SubscriptionModalProps) {
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | 'cancel' | 'delete'>(null);

  const patch = (next: Partial<SubscriptionFormValues>) => onChange({ ...values, ...next });
  const renderHint = (field: keyof SubscriptionFormValues) => hint?.(field) ?? null;

  const applySuggestion = (s: ServiceSuggestion) => {
    onChange({ ...values, name: s.name, category: s.category, cost: s.cost, billingCycle: s.cycle });
    setSuggestionsOpen(false);
  };

  // ── Derived preview values ─────────────────────────────────────────────
  const cost = Number.isFinite(values.cost) ? values.cost : 0;
  const activeCycle = values.billingCycle === 'annual' ? 'yearly' : values.billingCycle;
  const perMonth = normalizeToMonthlyCost(cost, values.billingCycle);
  const perYear = perMonth * 12;
  const categoryName =
    categories.find((c) => c.id === values.category)?.name ?? values.category;

  let prettyDate = '—';
  let relativeLabel = '';
  if (values.renewalDate) {
    const d = parseRenewalDate(values.renewalDate);
    if (!Number.isNaN(d.getTime())) {
      prettyDate = format(d, 'MMM d, yyyy');
      relativeLabel = relativeDaysSigned(differenceInCalendarDays(d, new Date()));
    }
  }

  const dateLabel = mode === 'edit' ? 'Next renewal' : 'First payment';
  const receiptDateLabel = mode === 'edit' ? 'Next renewal' : 'First charge';
  const stamp = mode === 'edit' ? 'Tracked' : 'New';
  const suggestions = filterSuggestions(values.name);

  const primaryLabel = submitLabel ?? (mode === 'add' ? 'Add subscription' : 'Save changes');
  const loadingLabel = mode === 'add' ? 'Adding…' : 'Saving…';

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const submitButton = (
    <Button
      type="submit"
      disabled={loading || saved}
      className={cn(saved && 'bg-success text-white hover:bg-success')}
    >
      {saved ? 'Saved ✓' : loading ? loadingLabel : primaryLabel}
    </Button>
  );

  return (
    <div className="flex flex-col min-[720px]:flex-row">
      {/* ── Left pane: form ─────────────────────────────────────────────── */}
      <form onSubmit={handleFormSubmit} className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="border-perf flex items-start justify-between px-[22px] pb-3.5 pt-5">
          <h2 className="text-[22px] font-extrabold tracking-tight text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground transition-colors hover:bg-secondary"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {banner && <div className="px-[22px] pt-4">{banner}</div>}

        {/* Fields */}
        <div className="space-y-[15px] px-[22px] pb-1 pt-4">
          {/* Service (autocomplete) */}
          <div>
            <FieldLabel>Service</FieldLabel>
            <div className="relative">
              <div className="flex h-[52px] items-center gap-2.5 rounded-lg border border-input bg-background px-2.5">
                <SubscriptionLogo
                  name={values.name || '?'}
                  category={values.category}
                  size={36}
                  className="bg-brand-orange/[0.08] text-brand-orange"
                />
                <input
                  type="text"
                  aria-label="Service name"
                  value={values.name}
                  disabled={loading}
                  placeholder="Search Netflix, Spotify, Figma…"
                  onChange={(e) => {
                    patch({ name: e.target.value });
                    setSuggestionsOpen(true);
                  }}
                  onFocus={() => setSuggestionsOpen(true)}
                  onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 160)}
                  className="min-w-0 flex-1 border-0 bg-transparent text-[15px] font-medium text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              {suggestionsOpen && suggestions.length > 0 && (
                <ul className="absolute inset-x-0 top-[calc(100%+4px)] z-40 overflow-hidden rounded-lg border border-input bg-background shadow-[0_12px_28px_rgba(40,33,20,.14)]">
                  {suggestions.map((s) => {
                    const Icon = categoryIconFor(s.category);
                    return (
                      <li key={s.name}>
                        <button
                          type="button"
                          // preventDefault keeps the input focused so the click
                          // registers before the blur-close timer fires.
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applySuggestion(s)}
                          className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-secondary"
                        >
                          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-secondary text-foreground">
                            <Icon size={15} aria-hidden="true" />
                          </span>
                          <span className="flex-1 text-sm font-medium text-foreground">{s.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {formatCurrency(s.cost, values.currency)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {renderHint('name')}
          </div>

          {/* Cost + Currency */}
          <div className="flex gap-3">
            <div className="flex-1">
              <FieldLabel>Cost</FieldLabel>
              <div className="flex h-10 items-center rounded-lg border border-input bg-background px-3">
                <span className="font-mono text-[15px] text-muted-foreground">
                  {currencySymbol(values.currency)}
                </span>
                <input
                  type="number"
                  aria-label="Cost"
                  min="0"
                  step="0.01"
                  required
                  value={values.cost}
                  disabled={loading}
                  onChange={(e) => patch({ cost: parseFloat(e.target.value) || 0 })}
                  className="ml-1 min-w-0 flex-1 border-0 bg-transparent font-mono text-[15px] font-bold tabular-nums text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              {renderHint('cost')}
            </div>
            <div className="w-[110px]">
              <FieldLabel>Currency</FieldLabel>
              <Select
                aria-label="Currency"
                value={values.currency}
                disabled={loading}
                onChange={(e) => patch({ currency: e.target.value })}
                className="font-mono"
              >
                {currencies.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>
              {renderHint('currency')}
            </div>
          </div>

          {/* Billing cycle — segmented */}
          <div>
            <FieldLabel>Billing cycle</FieldLabel>
            <div
              role="group"
              aria-label="Billing cycle"
              className="flex gap-px overflow-hidden rounded-lg border border-input bg-border"
            >
              {CYCLE_SEGMENTS.map((seg) => {
                const active = activeCycle === seg.id;
                return (
                  <button
                    key={seg.id}
                    type="button"
                    aria-pressed={active}
                    disabled={loading}
                    onClick={() => patch({ billingCycle: seg.id })}
                    className={cn(
                      'h-9 flex-1 text-[13px] font-medium transition-colors',
                      active
                        ? 'bg-foreground text-background'
                        : 'bg-background text-foreground hover:bg-secondary'
                    )}
                  >
                    {seg.label}
                  </button>
                );
              })}
            </div>
            {renderHint('billingCycle')}
          </div>

          {/* Date */}
          <div>
            <FieldLabel>{dateLabel}</FieldLabel>
            <div className="flex items-center gap-3">
              <Input
                type="date"
                aria-label={dateLabel}
                required
                value={values.renewalDate}
                disabled={loading}
                onChange={(e) => patch({ renewalDate: e.target.value })}
                className="flex-1 font-mono"
              />
              {relativeLabel && (
                <span className="whitespace-nowrap font-mono text-xs text-brand-orange">
                  {relativeLabel}
                </span>
              )}
            </div>
            {renderHint('renewalDate')}
          </div>

          {/* Category tiles */}
          <div>
            <FieldLabel>Category</FieldLabel>
            <div role="group" aria-label="Category" className="grid grid-cols-4 gap-1.5">
              {categories.map((cat) => {
                const Icon = categoryIconFor(cat.id);
                const active = values.category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={active}
                    disabled={loading}
                    onClick={() => patch({ category: cat.id })}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg border px-1 py-2.5 text-[11px] transition-colors',
                      active
                        ? 'border-brand-orange bg-brand-orange/[0.08] font-semibold text-brand-orange'
                        : 'border-input bg-background font-medium text-muted-foreground hover:bg-secondary'
                    )}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
            {renderHint('category')}
          </div>

          {/* Notes */}
          <div>
            <FieldLabel>Notes — optional</FieldLabel>
            <Textarea
              value={values.notes}
              disabled={loading}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder="Plan, who it's shared with, cancel-by date…"
              className="min-h-[48px]"
            />
            {renderHint('notes')}
          </div>
        </div>

        {error && (
          <div className="mx-[22px] mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 flex min-h-[69px] items-center gap-2 border-t border-border px-[22px] py-3.5">
          {confirm === 'cancel' ? (
            <>
              <span className="text-[13px] text-foreground">
                Cancel <strong>{values.name || 'this subscription'}</strong>? Paypr will stop
                renewing it.
              </span>
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirm(null)}>
                  Keep it
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="border-0 bg-brand-orange text-white hover:bg-brand-orange/90"
                  onClick={() => {
                    setConfirm(null);
                    onCancelRenewal?.();
                  }}
                >
                  Yes, cancel it
                </Button>
              </div>
            </>
          ) : confirm === 'delete' ? (
            <>
              <span className="text-[13px] text-foreground">
                Delete <strong>{values.name || 'this subscription'}</strong>? This can't be undone.
              </span>
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirm(null)}>
                  Keep it
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setConfirm(null);
                    onDelete?.();
                  }}
                >
                  Yes, delete it
                </Button>
              </div>
            </>
          ) : (
            <>
              {mode === 'edit' && (
                <div className="flex gap-2">
                  {editStatus === 'active' && onCancelRenewal && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      onClick={() => setConfirm('cancel')}
                      className="border-input text-brand-orange hover:border-brand-orange hover:bg-brand-orange/[0.08] hover:text-brand-orange"
                    >
                      Cancel subscription
                    </Button>
                  )}
                  {editStatus === 'cancelling' && onResume && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      onClick={() => onResume()}
                    >
                      Resume subscription
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={loading}
                      onClick={() => setConfirm('delete')}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      Delete
                    </Button>
                  )}
                </div>
              )}
              <div className="ml-auto">{submitButton}</div>
            </>
          )}
        </div>
      </form>

      {/* ── Right pane: live receipt preview ────────────────────────────── */}
      <aside className="flex w-full shrink-0 flex-col gap-4 border-dashed border-border bg-secondary px-[22px] pb-6 pt-5 border-t-[1.5px] min-[720px]:w-72 min-[720px]:border-l-[1.5px] min-[720px]:border-t-0">
        {/* Wordmark + stamp */}
        <div className="flex items-center justify-between">
          <span className="text-[17px] font-extrabold text-foreground">
            Paypr<span className="text-brand-orange">.</span>
          </span>
          <span className="-rotate-6 rounded-lg border-[1.5px] border-brand-orange px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-brand-orange">
            {stamp}
          </span>
        </div>

        {/* Identity */}
        <div className="flex items-center gap-2.5">
          <SubscriptionLogo
            name={values.name || '?'}
            category={values.category}
            size={40}
            className="bg-brand-orange/10 text-brand-orange"
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-foreground">
              {values.name || 'New subscription'}
            </p>
            <p className="font-mono text-[11px] uppercase text-muted-foreground">{categoryName}</p>
          </div>
        </div>

        {/* Detail rows */}
        <div className="space-y-2">
          <ReceiptRow label="Amount" value={formatCurrency(cost, values.currency)} />
          <ReceiptRow label="Billing" value={CYCLE_LABEL[activeCycle] ?? activeCycle} />
          <ReceiptRow label={receiptDateLabel} value={prettyDate} />
        </div>

        {/* Normalized */}
        <div className="space-y-1.5">
          <ReceiptRow label="Per month" value={formatCurrency(perMonth, values.currency)} small />
          <ReceiptRow label="Per year" value={formatCurrency(perYear, values.currency)} small />
        </div>

        {/* Total */}
        <div className="flex items-end justify-between border-t-[3px] border-double border-foreground pt-2">
          <span className="font-mono text-[10px] uppercase text-muted-foreground">
            {EVERY_LABEL[activeCycle] ?? 'EVERY CYCLE'}
          </span>
          <span className="text-[22px] font-extrabold tabular-nums text-foreground">
            {formatCurrency(cost, values.currency)}
          </span>
        </div>

        {/* Barcode flourish */}
        <div className="mt-auto space-y-1 pt-2">
          <div
            className="h-[34px] opacity-[0.85]"
            style={{
              background:
                'repeating-linear-gradient(90deg, hsl(var(--foreground)) 0, hsl(var(--foreground)) 2px, transparent 2px, transparent 4px)',
            }}
          />
          <p className="text-center font-mono text-[10px] tracking-[0.24em] text-muted-foreground">
            PAYPR · TRACKED
          </p>
        </div>
      </aside>
    </div>
  );
}
