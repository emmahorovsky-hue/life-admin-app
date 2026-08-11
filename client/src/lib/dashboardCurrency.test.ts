import { describe, it, expect, beforeEach } from 'vitest';
import {
  DASHBOARD_CURRENCY_STORAGE_KEY,
  dashboardCurrencyStorageKey,
  readDashboardCurrency,
  writeDashboardCurrency,
} from './dashboardCurrency';

describe('dashboard currency preference', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a selection for the account that made it', () => {
    writeDashboardCurrency('u1', 'EUR');
    expect(readDashboardCurrency('u1')).toBe('EUR');
  });

  // The same reason onboarding is keyed by user (LIF-242): logging out doesn't
  // clear localStorage, and the next account here may not hold EUR at all.
  it('keeps accounts apart', () => {
    writeDashboardCurrency('u1', 'EUR');
    expect(readDashboardCurrency('u2')).toBeNull();
    expect(localStorage.getItem(dashboardCurrencyStorageKey('u1'))).toBe('EUR');
  });

  it('has no preference before anything is stored', () => {
    expect(readDashboardCurrency('u1')).toBeNull();
  });

  it('ignores a hand-edited or half-written value', () => {
    localStorage.setItem(dashboardCurrencyStorageKey('u1'), '{"currency":"EUR"}');
    expect(readDashboardCurrency('u1')).toBeNull();
  });

  // Reached only if auth somehow hasn't resolved; it must not throw or write a
  // value the next account would inherit.
  it('is a no-op without a user', () => {
    expect(readDashboardCurrency(undefined)).toBeNull();
    writeDashboardCurrency(undefined, 'EUR');
    expect(localStorage.getItem(DASHBOARD_CURRENCY_STORAGE_KEY)).toBeNull();
    expect(localStorage.length).toBe(0);
  });
});
