import { describe, it, expect } from 'vitest';
import { SUBSCRIPTION_SUGGESTIONS, suggestionCost } from '@life-admin/shared';
import {
  DEFAULT_CURRENCY,
  currencyForLocale,
  dominantCurrency,
  formatCurrency,
  formatCurrencyTotals,
  formatCurrencyWithCode,
  sumByCurrency,
  supportedCurrency,
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

// This decides what a brand-new account is denominated in — the first-run flow
// prefills its currency control from it — so the misses matter as much as the
// hits: a wrong guess would be filed against every subscription the user starts
// with, and the dashboard reads its display currency back off that data.
describe('currencyForLocale', () => {
  it('maps the regions this app has a currency for', () => {
    expect(currencyForLocale('en-US')).toBe('USD');
    expect(currencyForLocale('en-GB')).toBe('GBP');
    expect(currencyForLocale('en-SG')).toBe('SGD');
    expect(currencyForLocale('de-DE')).toBe('EUR');
    expect(currencyForLocale('fr-FR')).toBe('EUR');
  });

  it('reads the region past a script subtag', () => {
    expect(currencyForLocale('zh-Hant-SG')).toBe('SGD');
  });

  it('accepts underscore-separated and lower-case tags', () => {
    expect(currencyForLocale('en_gb')).toBe('GBP');
  });

  it('returns null rather than guessing from language alone', () => {
    expect(currencyForLocale('en')).toBeNull();
    expect(currencyForLocale('de')).toBeNull();
  });

  it('returns null for a region with no supported currency', () => {
    expect(currencyForLocale('en-AU')).toBeNull();
    expect(currencyForLocale('ja-JP')).toBeNull();
  });

  it('returns null for junk', () => {
    expect(currencyForLocale('')).toBeNull();
    expect(currencyForLocale('!!')).toBeNull();
    expect(currencyForLocale(undefined)).toBeNull();
    expect(currencyForLocale(null)).toBeNull();
  });
});

describe('supportedCurrency', () => {
  it('accepts a supported code in any case', () => {
    expect(supportedCurrency('GBP')).toBe('GBP');
    expect(supportedCurrency('eur')).toBe('EUR');
  });

  it('rejects anything else', () => {
    expect(supportedCurrency('JPY')).toBeNull();
    expect(supportedCurrency('')).toBeNull();
    expect(supportedCurrency(undefined)).toBeNull();
  });
});

describe('suggestionCost', () => {
  const netflix = SUBSCRIPTION_SUGGESTIONS.find((s) => s.name === 'Netflix')!;

  it('returns the market list price for the currency', () => {
    expect(suggestionCost(netflix, 'USD')).toBe(15.99);
    expect(suggestionCost(netflix, 'GBP')).toBe(12.99);
  });

  it('falls back to USD for a currency the catalog has no price in', () => {
    expect(suggestionCost(netflix, 'JPY')).toBe(15.99);
  });

  // A missing entry would put "$0.00/mo" in front of a new user, so the catalog
  // has to stay complete rather than lean on that fallback.
  it('prices every service in every supported currency', () => {
    for (const service of SUBSCRIPTION_SUGGESTIONS) {
      for (const code of ['USD', 'EUR', 'GBP', 'SGD']) {
        expect(service.costs[code], `${service.name} in ${code}`).toBeGreaterThan(0);
      }
    }
  });
});
