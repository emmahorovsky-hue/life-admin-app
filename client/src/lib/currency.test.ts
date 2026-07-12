import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CURRENCY,
  dominantCurrency,
  formatCurrency,
  formatCurrencyTotals,
  formatCurrencyWithCode,
  sumByCurrency,
} from './currency';

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

describe('formatCurrencyWithCode', () => {
  it('names the currency, because symbols are not unique', () => {
    // USD and SGD share "$" — the code is what tells them apart.
    expect(formatCurrencyWithCode(10, 'USD')).toBe('$10.00 USD');
    expect(formatCurrencyWithCode(10, 'SGD')).toBe('$10.00 SGD');
  });

  it('leaves an unknown currency in its already-unambiguous form', () => {
    expect(formatCurrencyWithCode(10, 'JPY')).toBe('JPY 10.00');
  });
});

describe('sumByCurrency', () => {
  it('never adds different currencies together (LIF-107)', () => {
    // The bug: $10 + €10 rendered as one "€20.00". Now they stay apart.
    const totals = sumByCurrency(
      [
        { currency: 'USD', amount: 10 },
        { currency: 'EUR', amount: 10 },
      ],
      'USD'
    );
    expect(totals).toEqual([
      { currency: 'USD', amount: 10 },
      { currency: 'EUR', amount: 10 },
    ]);
  });

  it('sums amounts that do share a currency', () => {
    const totals = sumByCurrency(
      [
        { currency: 'EUR', amount: 10 },
        { currency: 'USD', amount: 4.5 },
        { currency: 'EUR', amount: 5.5 },
      ],
      'EUR'
    );
    expect(totals).toEqual([
      { currency: 'EUR', amount: 15.5 },
      { currency: 'USD', amount: 4.5 },
    ]);
  });

  it('leads with the primary currency, then orders by size', () => {
    const totals = sumByCurrency(
      [
        { currency: 'EUR', amount: 100 },
        { currency: 'GBP', amount: 50 },
        { currency: 'USD', amount: 1 },
      ],
      'USD'
    );
    expect(totals.map((t) => t.currency)).toEqual(['USD', 'EUR', 'GBP']);
  });

  it('breaks equal-amount ties by code so the order is stable', () => {
    const totals = sumByCurrency(
      [
        { currency: 'GBP', amount: 10 },
        { currency: 'EUR', amount: 10 },
      ],
      'USD'
    );
    expect(totals.map((t) => t.currency)).toEqual(['EUR', 'GBP']);
  });

  it('returns nothing for no entries', () => {
    expect(sumByCurrency([], 'USD')).toEqual([]);
  });
});

describe('formatCurrencyTotals', () => {
  it('renders a single currency exactly as before — bare symbol, no code', () => {
    expect(formatCurrencyTotals([{ currency: 'EUR', amount: 20 }], 'EUR')).toEqual(['€20.00']);
  });

  it('qualifies every line once several currencies are shown together', () => {
    expect(
      formatCurrencyTotals(
        [
          { currency: 'USD', amount: 10 },
          { currency: 'EUR', amount: 10 },
        ],
        'USD'
      )
    ).toEqual(['$10.00 USD', '€10.00 EUR']);
  });

  it('shows a zero in the fallback currency when there is nothing to total', () => {
    expect(formatCurrencyTotals([], 'GBP')).toEqual(['£0.00']);
    expect(formatCurrencyTotals([])).toEqual([formatCurrency(0, DEFAULT_CURRENCY)]);
  });
});
