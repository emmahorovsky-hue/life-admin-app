// Compute the *next* renewal date for a subscription on read, without mutating
// the DB. The stored `renewalDate` is treated as an anchor (first-payment date)
// and rolled forward by whole billing cycles until it lands today or later.
//
// All math is done in UTC. Stored renewalDate is UTC-midnight, so UTC getters
// read the intended calendar day and the emitted ISO string matches the stored
// shape on any host timezone (local getters would shift anchors a day on
// UTC-negative hosts).

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MAX_ITERATIONS = 1000; // defensive cap; far more cycles than any real anchor needs

// Days in a given UTC month. month is 0-indexed; day 0 of the next month is the
// last day of this month.
function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

// Add whole months to a UTC date, clamping the day to the target month's length
// so a month-end anchor (e.g. Jan 31) doesn't overflow into the next month.
function addUtcMonths(anchor: Date, months: number): Date {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();
  const day = anchor.getUTCDate();
  const targetMonthIndex = month + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const clampedDay = Math.min(day, daysInUtcMonth(targetYear, targetMonth));
  return new Date(Date.UTC(targetYear, targetMonth, clampedDay));
}

function addUtcDays(anchor: Date, days: number): Date {
  return new Date(anchor.getTime() + days * MS_PER_DAY);
}

// UTC date-only value (midnight) for comparing calendar days regardless of time.
function utcDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Roll `anchor` forward by `n` whole billing cycles, always computed from the
// ORIGINAL anchor (not incrementally) so month-end clamping never drifts.
function addCycles(anchor: Date, billingCycle: string, n: number): Date {
  switch (billingCycle.toLowerCase()) {
    case 'weekly':
      return addUtcDays(anchor, n * 7);
    case 'quarterly':
      return addUtcMonths(anchor, n * 3);
    case 'annual':
    case 'yearly':
      return addUtcMonths(anchor, n * 12);
    case 'monthly':
    default:
      // Unknown cycles fall back to monthly (mirrors the dashboard spend switch).
      return addUtcMonths(anchor, n);
  }
}

/**
 * Returns the next renewal date at today or later. If the anchor is already in
 * the future (or due today), it is returned unchanged.
 */
export function computeNextRenewal(
  anchor: Date,
  billingCycle: string,
  from: Date = new Date()
): Date {
  const today = utcDateOnly(from);
  let n = 0;
  let next = utcDateOnly(anchor);
  while (next < today && n < MAX_ITERATIONS) {
    n += 1;
    next = utcDateOnly(addCycles(anchor, billingCycle, n));
  }
  return next;
}

// "YYYY-MM-DDT00:00:00.000Z" from UTC parts — matches the stored renewalDate shape.
export function toRenewalIsoString(d: Date): string {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  ).toISOString();
}

// Calendar-day count from `from` to the renewal (today == 0), matching the
// frontend's date-fns differenceInCalendarDays semantics.
export function daysUntil(renewal: Date, from: Date = new Date()): number {
  return Math.round(
    (utcDateOnly(renewal).getTime() - utcDateOnly(from).getTime()) / MS_PER_DAY
  );
}

// Attach the derived nextRenewalDate to a subscription-like row.
export function withNextRenewal<
  T extends { renewalDate: Date | string; billingCycle: string }
>(sub: T, from: Date = new Date()): T & { nextRenewalDate: string } {
  const anchor = sub.renewalDate instanceof Date ? sub.renewalDate : new Date(sub.renewalDate);
  return {
    ...sub,
    nextRenewalDate: toRenewalIsoString(computeNextRenewal(anchor, sub.billingCycle, from)),
  };
}
