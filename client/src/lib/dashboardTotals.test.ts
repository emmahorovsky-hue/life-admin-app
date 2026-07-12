import { describe, it, expect } from 'vitest';
import {
  categorySpendByCurrency,
  formatCurrencyTotals,
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
