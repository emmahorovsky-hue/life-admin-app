// Maps ISO currency codes to display symbols. SGD intentionally renders as "$"
// to match the app's default currency and the landing-page copy.
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  SGD: '$',
  EUR: '€',
  GBP: '£',
};

export const DEFAULT_CURRENCY = 'SGD';

/** Format an amount with its currency's symbol, e.g. "£12.00". Falls back to a
 *  prefixed code ("JPY 12.00") for currencies without a known symbol. */
export function formatCurrency(amount: number, code: string): string {
  const symbol = CURRENCY_SYMBOLS[code];
  return symbol ? `${symbol}${amount.toFixed(2)}` : `${code} ${amount.toFixed(2)}`;
}

/** Pick the currency to use for aggregate figures: the most common one across
 *  the given currency codes, falling back to the app default when empty. The
 *  app sums costs across currencies, so this is a best-effort label for totals
 *  that are only strictly meaningful when all subscriptions share a currency. */
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
