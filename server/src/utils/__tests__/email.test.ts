import { canonicalEmail, displayEmail, emailFields } from '../email';

// canonicalEmail() is the identity function for every account in the database:
// change what it returns and you change which row a login resolves to. It is
// implemented as a thin wrapper over validator.normalizeEmail()'s DEFAULTS, so
// the risk is a dependency bump quietly re-partitioning accounts.
//
// The table below pins those defaults. If a `validator` upgrade breaks a row
// here, that is the upgrade telling you it would have split or merged live
// accounts — do not "fix" the expectation, pin the dependency and think.
describe('canonicalEmail', () => {
  const cases: [input: string, canonical: string, why: string][] = [
    ['First.Last@Gmail.com', 'firstlast@gmail.com', 'gmail: dots dropped, lowercased'],
    ['first.last+tag@googlemail.com', 'firstlast@gmail.com', 'gmail: +tag dropped, googlemail folded'],
    ['f.i.r.s.t@GOOGLEMAIL.COM', 'first@gmail.com', 'gmail: every dot dropped'],
    ['first.last@example.com', 'first.last@example.com', 'other domains: dots are significant'],
    ['First.Last@EXAMPLE.com', 'first.last@example.com', 'other domains: lowercased only'],
    ['user+tag@outlook.com', 'user@outlook.com', 'outlook: +subaddress dropped'],
    ['user+tag@hotmail.com', 'user@hotmail.com', 'hotmail: +subaddress dropped'],
    ['user+tag@icloud.com', 'user@icloud.com', 'icloud: +subaddress dropped'],
    ['user-tag@yahoo.com', 'user@yahoo.com', 'yahoo: -subaddress dropped'],
    ['user@ya.ru', 'user@yandex.ru', 'yandex: domain folded'],
    ['  First.Last@Gmail.com  ', 'firstlast@gmail.com', 'surrounding whitespace trimmed first'],
  ];

  it.each(cases)('%s -> %s (%s)', (input, expected) => {
    expect(canonicalEmail(input)).toBe(expected);
  });

  // normalizeEmail() assumes it was handed something isEmail() already
  // accepted: it THROWS on a non-string and returns "@" for an empty string.
  // canonicalEmail has to absorb both, because the rate-limit key generator
  // calls it on an unvalidated request body — a 500 there is an unauthenticated
  // denial-of-service on /forgot-password.
  it.each([
    ['a number', 123],
    ['an object', {}],
    ['an array', []],
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['whitespace only', '   '],
    ['a bare local part', 'not-an-email'],
    ['a missing local part', '@gmail.com'],
  ])('returns null for %s', (_label, input) => {
    expect(canonicalEmail(input)).toBeNull();
  });

  // Trimming before normalizeEmail is load-bearing, not cosmetic: normalizeEmail
  // does not trim, so " a@gmail.com " leaves the domain as "gmail.com " which
  // misses the Gmail branch entirely and yields a canonical form with the dots
  // still in it — two spellings of one inbox becoming two accounts.
  it('trims before normalizing, so a padded address canonicalizes like a clean one', () => {
    expect(canonicalEmail('  first.last@gmail.com  ')).toBe(canonicalEmail('first.last@gmail.com'));
  });

  // The property that makes the migration's backfill correct: canonicalizing the
  // display form gives the same answer as canonicalizing the raw input, so the
  // values stored historically by normalizeEmail() still match what we compute now.
  it('is unchanged by first passing the input through displayEmail', () => {
    for (const [input] of cases) {
      expect(canonicalEmail(displayEmail(input))).toBe(canonicalEmail(input));
    }
  });
});

describe('displayEmail', () => {
  it('trims and lowercases, and does nothing else', () => {
    expect(displayEmail('  First.Last+Tag@Gmail.com  ')).toBe('first.last+tag@gmail.com');
  });

  it('keeps dots, +tags and googlemail.com, which canonicalEmail would strip', () => {
    expect(displayEmail('first.last+news@googlemail.com')).toBe('first.last+news@googlemail.com');
    expect(canonicalEmail('first.last+news@googlemail.com')).toBe('firstlast@gmail.com');
  });
});

describe('emailFields', () => {
  it('returns both columns so no caller can write one without the other', () => {
    expect(emailFields('First.Last@Gmail.com')).toEqual({
      email: 'first.last@gmail.com',
      emailCanonical: 'firstlast@gmail.com',
    });
  });

  it('is an identity transform for a plain lowercase non-Gmail address', () => {
    expect(emailFields('test@example.com')).toEqual({
      email: 'test@example.com',
      emailCanonical: 'test@example.com',
    });
  });

  it('throws rather than writing a half-formed row', () => {
    expect(() => emailFields('not-an-email')).toThrow(/canonical/i);
  });
});
