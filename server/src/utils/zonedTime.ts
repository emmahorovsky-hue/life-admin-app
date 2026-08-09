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

// `en-CA` yields ISO-ish `YYYY-MM-DD` ordering, but the parts are read by name
// below rather than by position, so the locale only has to be one Node ships.
// hourCycle h23 is what keeps midnight as 0 instead of 24 (h24, the default for
// some locales), which would otherwise never match a daytime window.
function partsIn(instant: Date, timeZone: string): Intl.DateTimeFormatPart[] {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
  }).formatToParts(instant);
}

/**
 * Reads `instant` as a wall clock in `timeZone`.
 *
 * An unknown zone falls back to UTC rather than throwing. The profile endpoint
 * validates the name on write and the column defaults to `"UTC"`, so this is
 * only reachable via a zone the runtime later stopped recognising or a row
 * edited by hand — neither of which is worth failing a whole reminder run for.
 */
export function zonedNow(instant: Date, timeZone: string): ZonedNow {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = partsIn(instant, timeZone);
  } catch {
    parts = partsIn(instant, 'UTC');
  }

  const value = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((p) => p.type === type);
    return part ? Number(part.value) : 0;
  };

  return {
    hour: value('hour'),
    dateOnly: new Date(Date.UTC(value('year'), value('month') - 1, value('day'))),
  };
}
