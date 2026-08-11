import { cn } from '@/lib/utils';

interface CurrencySwitcherProps {
  /** Dominant-first, as every per-currency aggregate is ordered. */
  currencies: string[];
  value: string;
  onChange: (currency: string) => void;
  className?: string;
}

/**
 * Scopes the dashboard to one of the currencies the user actually holds
 * (LIF-257). Rendered only for accounts with more than one — a single-currency
 * user has nothing to switch between, so the caller leaves it out entirely
 * rather than showing a one-tab control.
 *
 * A segmented row of `aria-pressed` buttons, like the billing-cycle control in
 * the subscription modal, rather than ARIA tabs: the tabs pattern promises
 * arrow-key navigation between labelled panels, and this filters a whole page
 * rather than swapping one.
 */
export function CurrencySwitcher({ currencies, value, onChange, className }: CurrencySwitcherProps) {
  return (
    <div className={className}>
      {/* Eyebrow + hairline, matching the column headers on the receipt below */}
      <div className="flex items-center gap-3 mb-2">
        <span
          id="currency-switcher-label"
          className="text-xs font-mono uppercase tracking-widest text-muted-foreground"
        >
          Currency
        </span>
        <div className="border-perf flex-1" aria-hidden="true" />
      </div>

      {/* Labelled by the visible eyebrow rather than a duplicate aria-label, so
          the heading isn't announced twice. */}
      <div
        role="group"
        aria-labelledby="currency-switcher-label"
        className="flex flex-wrap gap-1.5"
      >
        {currencies.map((currency) => {
          const active = currency === value;
          return (
            <button
              key={currency}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(currency)}
              className={cn(
                // Both states carry a border so selecting one can't nudge the
                // row by a pixel. Space Mono is monospaced in both weights, so
                // the bold active label doesn't resize its tab either.
                'rounded-lg border px-3.5 py-1.5 font-mono text-[13px] transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                // `foreground`, not `primary`: identical in light mode (they're
                // the same ink), but in dark mode primary is an 18% grey that
                // barely separates from an unselected tab. This is the same
                // inversion the billing-cycle segments use.
                active
                  ? 'border-foreground bg-foreground font-bold text-background'
                  : 'border-input bg-background text-foreground/70 hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {currency}
            </button>
          );
        })}
      </div>
    </div>
  );
}
