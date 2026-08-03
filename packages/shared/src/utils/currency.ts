import { currencies } from '../constants/subscriptions';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  SGD: '$',
  EUR: '€',
  GBP: '£',
};

export const DEFAULT_CURRENCY = 'SGD';

// Region → currency, for the four currencies this app supports. Only regions
// that map unambiguously are listed; everything else is a miss, which callers
// read as "ask, don't guess".
const EUROZONE = [
  'AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES',
];

const CURRENCY_BY_REGION: Record<string, string> = {
  US: 'USD',
  GB: 'GBP',
  SG: 'SGD',
  ...Object.fromEntries(EUROZONE.map((region) => [region, 'EUR'])),
};

/** The code itself when this app supports it, otherwise null. */
export function supportedCurrency(code?: string | null): string | null {
  if (typeof code !== 'string') return null;
  const upper = code.toUpperCase();
  return currencies.includes(upper) ? upper : null;
}

/**
 * Best supported currency for a BCP-47 locale — "en-GB" → GBP, "de-DE" → EUR.
 *
 * Null, not a default, when the locale carries no region ("en") or names one
 * this app has no currency for ("en-AU"). A new user's money is the one thing
 * that must not be quietly guessed: callers prefill a *visible* control with
 * this and fall back to DEFAULT_CURRENCY, so a miss shows up as something to
 * correct rather than as a wrong number nobody was asked about.
 *
 * Language is deliberately ignored. "en" is spoken in every market here, and
 * inferring USD from it is exactly the silent error this exists to prevent.
 */
export function currencyForLocale(locale?: string | null): string | null {
  if (typeof locale !== 'string') return null;
  // Region is the 2-letter (or 3-digit UN M49) subtag after the language, past
  // any script: "zh-Hant-SG" has to resolve as well as "en-SG".
  const region = locale
    .replace(/_/g, '-')
    .split('-')
    .slice(1)
    .find((part) => /^[A-Za-z]{2}$/.test(part));
  if (!region) return null;
  return CURRENCY_BY_REGION[region.toUpperCase()] ?? null;
}

// An amount that carries its currency, so it can never be added to another one
// by accident. Aggregates return a list of these, one entry per currency.
export interface CurrencyAmount {
  currency: string;
  amount: number;
}

// Symbol for a currency code, falling back to the code itself when unknown.
export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code;
}

export function formatCurrency(amount: number, code: string): string {
  const symbol = CURRENCY_SYMBOLS[code];
  return symbol ? `${symbol}${amount.toFixed(2)}` : `${code} ${amount.toFixed(2)}`;
}

// Same as formatCurrency, but always names the currency. Symbols aren't unique
// (USD and SGD are both "$"), so a bare symbol is ambiguous as soon as two
// currencies are shown side by side.
export function formatCurrencyWithCode(amount: number, code: string): string {
  const symbol = CURRENCY_SYMBOLS[code];
  return symbol ? `${symbol}${amount.toFixed(2)} ${code}` : `${code} ${amount.toFixed(2)}`;
}

export function dominantCurrency(codes: string[]): string {
  const counts = new Map<string, number>();
  for (const code of codes) {
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  let best = DEFAULT_CURRENCY;
  let bestCount = 0;
  for (const [code, count] of counts) {
    if (count > bestCount) {
      best = code;
      bestCount = count;
    }
  }
  return best;
}

// Total a list of amounts *per currency*. This app has no exchange-rate source,
// so amounts in different currencies must never be added into one figure — a
// $10 + €10 "total" is meaningless. Callers render one line per entry instead.
//
// Ordering is stable and deterministic: primaryCurrency (the user's dominant
// one) first so the common single-currency case is unchanged, then the largest
// amounts, then alphabetically by code to break ties.
export function sumByCurrency(
  entries: CurrencyAmount[],
  primaryCurrency: string = DEFAULT_CURRENCY
): CurrencyAmount[] {
  const totals = new Map<string, number>();
  for (const { currency, amount } of entries) {
    totals.set(currency, (totals.get(currency) ?? 0) + amount);
  }

  return [...totals.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => {
      if (a.currency === primaryCurrency) return -1;
      if (b.currency === primaryCurrency) return 1;
      return b.amount - a.amount || a.currency.localeCompare(b.currency);
    });
}

// Display strings for a per-currency total, one per line.
//
// - No entries: a single zero in the fallback currency (an empty total row
//   would read as "missing" rather than "nothing due").
// - One currency: exactly what the app rendered before this existed — a bare
//   symbol, no code. This is the overwhelmingly common case.
// - Several currencies: each amount is qualified with its code, because the
//   figures cannot be combined and "$10.00 / $10.00" (USD vs SGD) would be
//   unreadable otherwise.
export function formatCurrencyTotals(
  totals: CurrencyAmount[],
  fallbackCurrency: string = DEFAULT_CURRENCY
): string[] {
  if (totals.length === 0) return [formatCurrency(0, fallbackCurrency)];
  if (totals.length === 1) return [formatCurrency(totals[0].amount, totals[0].currency)];
  return totals.map(({ currency, amount }) => formatCurrencyWithCode(amount, currency));
}
