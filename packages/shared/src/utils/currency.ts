const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  SGD: '$',
  EUR: '€',
  GBP: '£',
};

export const DEFAULT_CURRENCY = 'SGD';

export function formatCurrency(amount: number, code: string): string {
  const symbol = CURRENCY_SYMBOLS[code];
  return symbol ? `${symbol}${amount.toFixed(2)}` : `${code} ${amount.toFixed(2)}`;
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
