import { describe, it, expect } from 'vitest';
import { CURRENCIES, SUBSCRIPTION_SUGGESTIONS, currencies, suggestionCost } from '@life-admin/shared';
import {
  DEFAULT_CURRENCY,
  currencyName,
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

  it('puts the symbol after the amount where the market writes it that way', () => {
    expect(formatCurrency(15.99, 'PLN')).toBe('15.99 zł');
    expect(formatCurrency(149, 'SEK')).toBe('149.00 kr');
    expect(formatCurrency(279, 'CZK')).toBe('279.00 Kč');
  });

  it('drops the decimals for currencies whose market does not write them', () => {
    expect(formatCurrency(1590, 'JPY')).toBe('¥1590');
    expect(formatCurrency(4490, 'HUF')).toBe('4490 Ft');
  });

  it('never localises the digits, only the symbol', () => {
    // Poland writes "15,99 zł". We do not: choosing a decimal separator means
    // choosing a locale this app deliberately never chooses, and the receipt
    // layouts align these with tabular-nums.
    expect(formatCurrency(15.99, 'PLN')).not.toContain(',');
    expect(formatCurrency(1234.5, 'USD')).toBe('$1234.50');
  });

  it('falls back to a prefixed code for unknown currencies', () => {
    expect(formatCurrency(12, 'ZZZ')).toBe('ZZZ 12.00');
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
    // "kr" is shared three ways, so the code matters just as much there, and it
    // still goes last even though the symbol already trails the amount.
    expect(formatCurrencyWithCode(10, 'SEK')).toBe('10.00 kr SEK');
    expect(formatCurrencyWithCode(10, 'NOK')).toBe('10.00 kr NOK');
  });

  it('leaves an unknown currency in its already-unambiguous form', () => {
    expect(formatCurrencyWithCode(10, 'ZZZ')).toBe('ZZZ 10.00');
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

  it('maps the regions added with the wider currency set', () => {
    expect(currencyForLocale('pl-PL')).toBe('PLN');
    expect(currencyForLocale('ja-JP')).toBe('JPY');
    expect(currencyForLocale('en-AU')).toBe('AUD');
    expect(currencyForLocale('sv-SE')).toBe('SEK');
    expect(currencyForLocale('de-CH')).toBe('CHF');
  });

  it('returns null for a region with no supported currency', () => {
    expect(currencyForLocale('en-ZA')).toBeNull();
    expect(currencyForLocale('ko-KR')).toBeNull();
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

  it('accepts the currencies added with the wider set', () => {
    expect(supportedCurrency('pln')).toBe('PLN');
    expect(supportedCurrency('JPY')).toBe('JPY');
  });

  it('rejects anything else', () => {
    // Well-formed and real, but not one this app supports.
    expect(supportedCurrency('KRW')).toBeNull();
    expect(supportedCurrency('ZZZ')).toBeNull();
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

  it('prices the currencies added with the wider set at local price points', () => {
    // Not the USD number under a different sign — that is the whole reason the
    // catalog is per-currency rather than converted.
    expect(suggestionCost(netflix, 'PLN')).toBe(49);
    expect(suggestionCost(netflix, 'JPY')).toBe(1590);
  });

  it('falls back to USD for a currency the catalog has no price in', () => {
    expect(suggestionCost(netflix, 'ZZZ')).toBe(15.99);
  });

  // A missing entry would put "$0.00/mo" in front of a new user, and a currency
  // added to the registry without a price column would put a US number under
  // its sign. Driven off `currencies` so adding a row to the registry without
  // pricing it fails here rather than in front of a user.
  it('prices every service in every supported currency', () => {
    for (const service of SUBSCRIPTION_SUGGESTIONS) {
      for (const code of currencies) {
        expect(service.costs[code], `${service.name} in ${code}`).toBeGreaterThan(0);
      }
    }
  });
});


// The registry is the single source of truth for every derived map — symbols,
// regions, decimals — so a malformed row breaks formatting and locale guessing
// at once rather than in one visible place.
describe('CURRENCIES registry', () => {
  it('describes every supported code exactly once', () => {
    expect(CURRENCIES.map((c) => c.code)).toEqual(currencies);
    expect(new Set(currencies).size).toBe(currencies.length);
  });

  it('gives every currency a usable symbol, name, position and precision', () => {
    for (const currency of CURRENCIES) {
      expect(currency.code, currency.code).toMatch(/^[A-Z]{3}$/);
      expect(currency.name.length, currency.code).toBeGreaterThan(0);
      expect(currency.symbol.length, currency.code).toBeGreaterThan(0);
      expect(['prefix', 'suffix'], currency.code).toContain(currency.position);
      expect([0, 2], currency.code).toContain(currency.decimals);
    }
  });

  it('claims no region twice, so locale guessing stays deterministic', () => {
    const regions = CURRENCIES.flatMap((c) => c.regions);
    expect(new Set(regions).size).toBe(regions.length);
  });

  it('names a currency, falling back to the code', () => {
    expect(currencyName('PLN')).toBe('Polish złoty');
    expect(currencyName('ZZZ')).toBe('ZZZ');
  });
});
