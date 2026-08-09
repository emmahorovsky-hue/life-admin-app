// Reading an instant as a wall clock somewhere else (LIF-252). Pure, no DB.

import { isSameLocalDay, zonedNow } from '../utils/zonedTime';

const iso = (d: Date) => d.toISOString();

describe('zonedNow', () => {
  it('reads the local hour, not the server hour', () => {
    // 09:00 UTC is the middle of the night on the US west coast — the exact
    // case that made a daily 09:00 UTC push unacceptable.
    const instant = new Date('2026-06-21T09:00:00.000Z');
    expect(zonedNow(instant, 'UTC').hour).toBe(9);
    expect(zonedNow(instant, 'America/Los_Angeles').hour).toBe(2);
    expect(zonedNow(instant, 'America/New_York').hour).toBe(5);
    expect(zonedNow(instant, 'Asia/Singapore').hour).toBe(17);
  });

  it('reports the local calendar day, which can differ from the UTC one', () => {
    // 20:00 UTC on the 20th is already the 21st in Auckland (UTC+12).
    const instant = new Date('2026-06-20T20:00:00.000Z');
    expect(iso(zonedNow(instant, 'UTC').dateOnly)).toBe('2026-06-20T00:00:00.000Z');
    expect(iso(zonedNow(instant, 'Pacific/Auckland').dateOnly)).toBe('2026-06-21T00:00:00.000Z');
    // ...and still the 20th in Los Angeles.
    expect(iso(zonedNow(instant, 'America/Los_Angeles').dateOnly)).toBe('2026-06-20T00:00:00.000Z');
  });

  it('returns midnight as hour 0, not 24', () => {
    // h23 vs h24: some locales render midnight as "24", which would never fall
    // inside a daytime window and would silently exclude those users.
    const instant = new Date('2026-06-21T00:00:00.000Z');
    expect(zonedNow(instant, 'UTC').hour).toBe(0);
  });

  it('handles half-hour and quarter-hour offsets', () => {
    // India is UTC+5:30 and Nepal UTC+5:45, so an on-the-hour cron never lands
    // on :00 there. The hour must still advance normally.
    const instant = new Date('2026-06-21T04:00:00.000Z');
    expect(zonedNow(instant, 'Asia/Kolkata').hour).toBe(9); // 09:30
    expect(zonedNow(instant, 'Asia/Kathmandu').hour).toBe(9); // 09:45
  });

  it('tracks daylight saving', () => {
    const winter = new Date('2026-01-15T09:00:00.000Z');
    const summer = new Date('2026-07-15T09:00:00.000Z');
    expect(zonedNow(winter, 'Europe/London').hour).toBe(9); // GMT
    expect(zonedNow(summer, 'Europe/London').hour).toBe(10); // BST
  });

  it('falls back to UTC for an unrecognised zone instead of throwing', () => {
    const instant = new Date('2026-06-21T09:00:00.000Z');
    expect(zonedNow(instant, 'Mars/Olympus_Mons')).toEqual(zonedNow(instant, 'UTC'));
  });

  it('reads the same zone repeatedly without drifting (cached formatter)', () => {
    // The formatter is memoised per zone; the cache must not outlive its
    // correctness — same zone, different instants, still different answers.
    const morning = new Date('2026-06-21T16:00:00.000Z');
    const evening = new Date('2026-06-22T04:00:00.000Z');
    expect(zonedNow(morning, 'America/Los_Angeles').hour).toBe(9);
    expect(zonedNow(evening, 'America/Los_Angeles').hour).toBe(21);
    expect(zonedNow(morning, 'America/Los_Angeles').hour).toBe(9);
  });
});

describe('isSameLocalDay', () => {
  // Whether a prior send attempt happened "today" is what bounds retries after
  // a failure, and today is the user's, not the server's.
  const today = new Date(Date.UTC(2026, 5, 21));

  it('counts an instant inside the local day', () => {
    expect(isSameLocalDay(new Date('2026-06-21T09:00:00.000Z'), 'UTC', today)).toBe(true);
    expect(isSameLocalDay(new Date('2026-06-21T23:59:00.000Z'), 'UTC', today)).toBe(true);
  });

  it('counts an instant outside it', () => {
    expect(isSameLocalDay(new Date('2026-06-20T23:59:00.000Z'), 'UTC', today)).toBe(false);
    expect(isSameLocalDay(new Date('2026-06-22T00:01:00.000Z'), 'UTC', today)).toBe(false);
  });

  it('reads the day in the given zone, not UTC', () => {
    // 22:00 UTC on the 20th is already the 21st in Auckland, and still the 20th
    // in Los Angeles — so the same attempt is "today" for one and not the other.
    const instant = new Date('2026-06-20T22:00:00.000Z');
    expect(isSameLocalDay(instant, 'Pacific/Auckland', today)).toBe(true);
    expect(isSameLocalDay(instant, 'America/Los_Angeles', today)).toBe(false);
  });
});
