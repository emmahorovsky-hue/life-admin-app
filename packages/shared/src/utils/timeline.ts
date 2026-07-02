import { differenceInCalendarDays } from 'date-fns';

export type BucketId = 'thisWeek' | 'laterThisMonth' | 'nextMonth';

// renewalDate is stored as UTC-midnight ISO; parse the date-only portion as a
// LOCAL calendar date so day-counts/buckets don't shift a day in timezones
// behind UTC (e.g. "2026-06-30T00:00:00.000Z" → local Jun 30, not Jun 29).
export function parseRenewalDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function relativeDays(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

// Like relativeDays but also describes past dates ("N days ago" / "yesterday").
// Used where the target date can be in the past (e.g. an editing subscription's
// next renewal that has already lapsed).
export function relativeDaysSigned(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days > 0) return `in ${days} days`;
  return `${-days} days ago`;
}

export function bucketFor(renewal: Date, today: Date): BucketId | null {
  const days = differenceInCalendarDays(renewal, today);
  if (days < 0) return null;
  if (days <= 7) return 'thisWeek';

  const sameMonth =
    renewal.getFullYear() === today.getFullYear() && renewal.getMonth() === today.getMonth();
  if (sameMonth) return 'laterThisMonth';

  const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  if (renewal.getFullYear() === next.getFullYear() && renewal.getMonth() === next.getMonth()) {
    return 'nextMonth';
  }
  return null;
}
