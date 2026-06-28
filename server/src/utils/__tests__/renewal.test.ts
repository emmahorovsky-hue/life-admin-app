import {
  computeNextRenewal,
  toRenewalIsoString,
  daysUntil,
  withNextRenewal,
} from '../renewal';

// Fixed "now" so results are deterministic. All inputs use explicit UTC (Z) and
// the util does UTC-only math, so these assertions are timezone-independent.
const NOW = new Date('2026-06-28T09:30:00.000Z');
const utc = (s: string) => new Date(s);

describe('computeNextRenewal', () => {
  it('rolls a past monthly anchor forward to the next future occurrence', () => {
    // Anchor on the 15th, months in the past → next future 15th is 2026-07-15.
    const next = computeNextRenewal(utc('2026-01-15T00:00:00.000Z'), 'monthly', NOW);
    expect(toRenewalIsoString(next)).toBe('2026-07-15T00:00:00.000Z');
  });

  it('returns a future anchor unchanged', () => {
    const next = computeNextRenewal(utc('2026-09-01T00:00:00.000Z'), 'monthly', NOW);
    expect(toRenewalIsoString(next)).toBe('2026-09-01T00:00:00.000Z');
  });

  it('treats an anchor due today as today (not skipped)', () => {
    const next = computeNextRenewal(utc('2026-06-28T00:00:00.000Z'), 'monthly', NOW);
    expect(toRenewalIsoString(next)).toBe('2026-06-28T00:00:00.000Z');
  });

  it('clamps month-end anchors without drifting (Jan 31 anchor)', () => {
    // Always computed from the ORIGINAL Jan 31 anchor (not incrementally), so
    // each month clamps independently: Feb 28, Mar 31, Apr 30, May 31, Jun 30…
    const anchor = utc('2026-01-31T00:00:00.000Z');
    // First occurrence >= 2026-06-28 is Jun 30 (June has 30 days).
    expect(toRenewalIsoString(computeNextRenewal(anchor, 'monthly', NOW))).toBe(
      '2026-06-30T00:00:00.000Z'
    );
    // Crucially, the NEXT month is the 31st again — no permanent drift to the 30th.
    const july = new Date('2026-07-01T00:00:00.000Z');
    expect(toRenewalIsoString(computeNextRenewal(anchor, 'monthly', july))).toBe(
      '2026-07-31T00:00:00.000Z'
    );
    // Rolling into a 30-day month clamps to its last day.
    const sep = new Date('2026-09-01T00:00:00.000Z');
    expect(toRenewalIsoString(computeNextRenewal(anchor, 'monthly', sep))).toBe(
      '2026-09-30T00:00:00.000Z'
    );
  });

  it('handles a Feb 29 leap-year clamp', () => {
    // Jan 31 + 1 month in 2028 (leap) → Feb 29.
    const anchor = utc('2028-01-31T00:00:00.000Z');
    const from = new Date('2028-02-15T00:00:00.000Z');
    expect(toRenewalIsoString(computeNextRenewal(anchor, 'monthly', from))).toBe(
      '2028-02-29T00:00:00.000Z'
    );
  });

  it('rolls weekly anchors by 7-day steps', () => {
    const next = computeNextRenewal(utc('2026-06-01T00:00:00.000Z'), 'weekly', NOW);
    expect(toRenewalIsoString(next)).toBe('2026-06-29T00:00:00.000Z'); // 1,8,15,22,29
  });

  it('rolls quarterly anchors by 3-month steps', () => {
    const next = computeNextRenewal(utc('2026-01-10T00:00:00.000Z'), 'quarterly', NOW);
    expect(toRenewalIsoString(next)).toBe('2026-07-10T00:00:00.000Z'); // Jan→Apr→Jul
  });

  it('treats annual and yearly identically', () => {
    const anchor = utc('2025-03-05T00:00:00.000Z');
    const annual = computeNextRenewal(anchor, 'annual', NOW);
    const yearly = computeNextRenewal(anchor, 'yearly', NOW);
    expect(toRenewalIsoString(annual)).toBe('2027-03-05T00:00:00.000Z');
    expect(toRenewalIsoString(yearly)).toBe(toRenewalIsoString(annual));
  });

  it('falls back to monthly for an unknown billing cycle', () => {
    const next = computeNextRenewal(utc('2026-01-15T00:00:00.000Z'), 'fortnightly', NOW);
    expect(toRenewalIsoString(next)).toBe('2026-07-15T00:00:00.000Z');
  });
});

describe('toRenewalIsoString', () => {
  it('emits UTC midnight with no day shift', () => {
    expect(toRenewalIsoString(utc('2026-07-15T18:45:00.000Z'))).toBe(
      '2026-07-15T00:00:00.000Z'
    );
  });
});

describe('daysUntil', () => {
  it('counts whole calendar days, today === 0', () => {
    expect(daysUntil(utc('2026-06-28T00:00:00.000Z'), NOW)).toBe(0);
    expect(daysUntil(utc('2026-06-29T00:00:00.000Z'), NOW)).toBe(1);
    expect(daysUntil(utc('2026-07-05T00:00:00.000Z'), NOW)).toBe(7);
  });
});

describe('withNextRenewal', () => {
  it('attaches nextRenewalDate, accepting a Date or ISO-string anchor', () => {
    const fromDate = withNextRenewal(
      { renewalDate: utc('2026-01-15T00:00:00.000Z'), billingCycle: 'monthly', id: 'x' },
      NOW
    );
    const fromString = withNextRenewal(
      { renewalDate: '2026-01-15T00:00:00.000Z', billingCycle: 'monthly', id: 'x' },
      NOW
    );
    expect(fromDate.nextRenewalDate).toBe('2026-07-15T00:00:00.000Z');
    expect(fromString.nextRenewalDate).toBe('2026-07-15T00:00:00.000Z');
    expect(fromDate.id).toBe('x'); // preserves other fields
  });
});
