import { describe, it, expect } from 'vitest';
import { formatCurrency, dominantCurrency, DEFAULT_CURRENCY } from './currency';

describe('formatCurrency', () => {
  it('prefixes a known symbol with two decimals', () => {
    expect(formatCurrency(12, 'GBP')).toBe('£12.00');
    expect(formatCurrency(9.5, 'EUR')).toBe('€9.50');
  });

  it('renders USD and SGD both as "$"', () => {
    expect(formatCurrency(5, 'USD')).toBe('$5.00');
    expect(formatCurrency(5, 'SGD')).toBe('$5.00');
  });

  it('falls back to a prefixed code for unknown currencies', () => {
    expect(formatCurrency(12, 'JPY')).toBe('JPY 12.00');
  });
});

describe('dominantCurrency', () => {
  it('returns the most common currency code', () => {
    expect(dominantCurrency(['USD', 'EUR', 'USD'])).toBe('USD');
  });

  it('falls back to the default currency for an empty list', () => {
    expect(dominantCurrency([])).toBe(DEFAULT_CURRENCY);
  });

  it('keeps the first-seen winner on a tie', () => {
    // 'EUR' and 'GBP' both appear once; 'EUR' is seen first.
    expect(dominantCurrency(['EUR', 'GBP'])).toBe('EUR');
  });
});
