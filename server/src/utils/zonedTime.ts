// Reading an instant as a wall clock in someone else's timezone.
//
// Renewal reminders are delivered per user in their own local time (LIF-252),
// which needs two things from `now`: what hour it is where they are, and what
// calendar day it is there. Both come from one Intl format pass, because both
// must describe the same instant in the same zone — deriving the day from a
// UTC-shifted Date and the hour from Intl is how off-by-one bugs get in.

/** A wall-clock reading of one instant in one timezone. */
export type ZonedNow = {
  /** Local hour, 0–23. */
  hour: number;
  /**
   * The local calendar day, expressed as a UTC-midnight Date.
   *
   * A stand-in, not a real instant: `utils/renewal.ts` does all its math on
   * UTC-midnight values (the stored `renewalDate` anchor has that shape), so
   * handing it the *local* day in that same shape makes `computeNextRenewal`
   * and `daysUntil` answer in the user's calendar rather than the server's.
   */
  dateOnly: Date;
};

// One formatter per zone, reused. Constructing an Intl.DateTimeFormat is the
// expensive part of this module and the reminder job now reads a clock for
// every candidate user every hour, so building one per call meant thousands of
// throwaway formatters a day for a handful of distinct zones. Bounded by the
// zones actually stored on users: the profile endpoint only accepts names the
// runtime knows, and a name it doesn't throws below without being cached.
const formatters = new Map<string, Intl.DateTimeFormat>();

// `en-CA` yields ISO-ish `YYYY-MM-DD` ordering, but the parts are read by name
// below rather than by position, so the locale only has to be one Node ships.
// hourCycle h23 is what keeps midnight as 0 instead of 24 (h24, the default for
// some locales), which would otherwise never match a daytime window.
function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
  });
  formatters.set(timeZone, formatter);
  return formatter;
}

// All four parts or nothing. A partial reading is worse than no reading: a
// missing `hour` would default to 0, putting the user permanently outside any
// daytime window and silently never notifying them, and a missing date part
// would produce a year-0 date and a nonsense countdown. Neither announces
// itself, so an unreadable set falls back to UTC rather than being patched up.
function read(parts: Intl.DateTimeFormatPart[]): ZonedNow | null {
  const value = (type: Intl.DateTimeFormatPartTypes): number | null => {
    const part = parts.find((p) => p.type === type);
    if (!part) return null;
    const parsed = Number(part.value);
    return Number.isInteger(parsed) ? parsed : null;
  };

  const hour = value('hour');
  const year = value('year');
  const month = value('month');
  const day = value('day');
  if (hour === null || year === null || month === null || day === null) return null;

  return { hour, dateOnly: new Date(Date.UTC(year, month - 1, day)) };
}

// The last resort, straight off the Date's UTC getters — no Intl, so nothing
// left that can fail.
function utcReading(instant: Date): ZonedNow {
  return {
    hour: instant.getUTCHours(),
    dateOnly: new Date(
      Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate())
    ),
  };
}

/**
 * Reads `instant` as a wall clock in `timeZone`.
 *
 * An unknown or unreadable zone falls back to UTC rather than throwing. The
 * profile endpoint validates the name on write and the column defaults to
 * `"UTC"`, so this is only reachable via a zone the runtime later stopped
 * recognising or a row edited by hand — neither of which is worth failing a
 * whole reminder run for.
 */
export function zonedNow(instant: Date, timeZone: string): ZonedNow {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = formatterFor(timeZone).formatToParts(instant);
  } catch {
    return utcReading(instant);
  }
  return read(parts) ?? utcReading(instant);
}

/** Whether `instant` falls on `localDay` (a `dateOnly` value) in `timeZone`. */
export function isSameLocalDay(instant: Date, timeZone: string, localDay: Date): boolean {
  return zonedNow(instant, timeZone).dateOnly.getTime() === localDay.getTime();
}
