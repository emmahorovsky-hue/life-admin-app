import { describe, it, expect } from 'vitest';
import {
  categorySpendByCurrency,
  currencyOptions,
  formatCurrencyTotals,
  pickCurrency,
  renewalTotals,
  spendTotals,
} from '@life-admin/shared';

// The dashboard aggregates shared by the web and mobile dashboards. The rule
// they all enforce: with no exchange-rate source, costs in different currencies
// are never summed into a single figure (LIF-107).

describe('spendTotals', () => {
  it('keeps monthly/annual spend split per currency', () => {
    const totals = spendTotals(
      {
        totalMonthlySpend: '20.00', // the meaningless cross-currency sum
        totalAnnualSpend: '240.00',
        spendByCurrency: [
          { currency: 'USD', totalMonthlySpend: '10.00', totalAnnualSpend: '120.00', activeSubscriptions: 1 },
          { currency: 'EUR', totalMonthlySpend: '10.00', totalAnnualSpend: '120.00', activeSubscriptions: 1 },
        ],
      },
      'USD'
    );

    expect(formatCurrencyTotals(totals.monthly, 'USD')).toEqual(['$10.00 USD', '€10.00 EUR']);
    expect(formatCurrencyTotals(totals.annual, 'USD')).toEqual(['$120.00 USD', '€120.00 EUR']);
  });

  it('renders a single-currency user exactly as before', () => {
    const totals = spendTotals(
      {
        totalMonthlySpend: '25.98',
        totalAnnualSpend: '311.76',
        spendByCurrency: [
          { currency: 'SGD', totalMonthlySpend: '25.98', totalAnnualSpend: '311.76', activeSubscriptions: 2 },
        ],
      },
      'SGD'
    );

    expect(formatCurrencyTotals(totals.monthly, 'SGD')).toEqual(['$25.98']);
    expect(formatCurrencyTotals(totals.annual, 'SGD')).toEqual(['$311.76']);
  });

  it('falls back to the flat totals when the server is older than the client', () => {
    const totals = spendTotals(
      { totalMonthlySpend: '25.98', totalAnnualSpend: '311.76' },
      'GBP'
    );

    expect(totals.monthly).toEqual([{ currency: 'GBP', amount: 25.98 }]);
    expect(totals.annual).toEqual([{ currency: 'GBP', amount: 311.76 }]);
  });
});

describe('renewalTotals', () => {
  const currencyOf = (id: string) => ({ a: 'USD', b: 'EUR', c: 'USD' })[id] ?? 'SGD';

  it('totals a mixed-currency set of renewals per currency', () => {
    const totals = renewalTotals(
      [
        { id: 'a', cost: '10.00' },
        { id: 'b', cost: '10.00' },
        { id: 'c', cost: '5.00' },
      ],
      currencyOf,
      'USD'
    );

    // Not one "$25.00" (and definitely not "€25.00") — two honest figures.
    expect(totals).toEqual([
      { currency: 'USD', amount: 15 },
      { currency: 'EUR', amount: 10 },
    ]);
    expect(formatCurrencyTotals(totals, 'USD')).toEqual(['$15.00 USD', '€10.00 EUR']);
  });

  it('stays a single unqualified figure when every renewal shares a currency', () => {
    const totals = renewalTotals(
      [
        { id: 'a', cost: '10.00' },
        { id: 'c', cost: '5.99' },
      ],
      currencyOf,
      'USD'
    );

    expect(formatCurrencyTotals(totals, 'USD')).toEqual(['$15.99']);
  });

  it('shows a zero when nothing is due', () => {
    expect(formatCurrencyTotals(renewalTotals([], currencyOf, 'EUR'), 'EUR')).toEqual(['€0.00']);
  });
});

describe('categorySpendByCurrency', () => {
  const sub = (currency: string, category: string, cost: string, billingCycle = 'monthly') => ({
    currency,
    category,
    cost,
    billingCycle,
  });

  it('splits the category chart per currency instead of mixing bars', () => {
    const groups = categorySpendByCurrency(
      [
        sub('USD', 'streaming', '10.00'),
        sub('EUR', 'streaming', '30.00'),
        sub('USD', 'software', '120.00', 'annual'), // 10.00/month
      ],
      'USD'
    );

    expect(groups).toEqual([
      {
        currency: 'USD',
        data: [
          { name: 'Streaming', total: 10 },
          { name: 'Software', total: 10 },
        ],
      },
      { currency: 'EUR', data: [{ name: 'Streaming', total: 30 }] },
    ]);
  });

  it('sums same-currency subscriptions within a category and sorts by size', () => {
    const groups = categorySpendByCurrency(
      [
        sub('SGD', 'music', '9.99'),
        sub('SGD', 'streaming', '15.99'),
        sub('SGD', 'streaming', '4.01'),
      ],
      'SGD'
    );

    expect(groups).toEqual([
      {
        currency: 'SGD',
        data: [
          { name: 'Streaming', total: 20 },
          { name: 'Music', total: 9.99 },
        ],
      },
    ]);
  });

  it('leads with the primary currency', () => {
    const groups = categorySpendByCurrency(
      [sub('EUR', 'gaming', '100.00'), sub('GBP', 'gaming', '1.00')],
      'GBP'
    );

    expect(groups.map((g) => g.currency)).toEqual(['GBP', 'EUR']);
  });

  it('returns no groups for no subscriptions', () => {
    expect(categorySpendByCurrency([], 'SGD')).toEqual([]);
  });
});

// The dashboard is scoped to one currency at a time (LIF-257). These two are
// how that scope is chosen and applied — neither adds anything up.

describe('currencyOptions', () => {
  it('lists the currencies dominant-first, as every other aggregate is ordered', () => {
    const options = currencyOptions(
      [
        { currency: 'USD', amount: 10 },
        { currency: 'EUR', amount: 30 },
        { currency: 'GBP', amount: 20 },
      ],
      [],
      'USD'
    );

    expect(options).toEqual(['USD', 'EUR', 'GBP']);
  });

  it('reads a single-currency account as one option, so the switcher stays hidden', () => {
    expect(currencyOptions([{ currency: 'SGD', amount: 25.98 }], ['SGD', 'SGD'], 'SGD')).toEqual([
      'SGD',
    ]);
  });

  // A currency whose subscriptions are all cancelled has no active spend, but
  // still owns renewals and a category chart. Without a tab, that data would be
  // on the page with no way to reach it.
  it('keeps a currency that only has cancelled rows left, ranked last', () => {
    const options = currencyOptions([{ currency: 'SGD', amount: 25.98 }], ['SGD', 'EUR'], 'SGD');

    expect(options).toEqual(['SGD', 'EUR']);
  });

  it('still leads with the primary currency when it has no spend of its own', () => {
    expect(currencyOptions([{ currency: 'USD', amount: 40 }], ['GBP'], 'GBP')).toEqual([
      'GBP',
      'USD',
    ]);
  });
});

describe('pickCurrency', () => {
  const totals = [
    { currency: 'USD', amount: 10 },
    { currency: 'EUR', amount: 30 },
  ];

  it('narrows a per-currency total to the currency on screen', () => {
    expect(pickCurrency(totals, 'EUR')).toEqual([{ currency: 'EUR', amount: 30 }]);
    // Narrowed, never combined — the other currency is hidden, not folded in.
    expect(formatCurrencyTotals(pickCurrency(totals, 'EUR'), 'EUR')).toEqual(['€30.00']);
  });

  it('renders a currency with nothing in it as a zero, not a blank', () => {
    expect(pickCurrency(totals, 'GBP')).toEqual([]);
    expect(formatCurrencyTotals(pickCurrency(totals, 'GBP'), 'GBP')).toEqual(['£0.00']);
  });
});
