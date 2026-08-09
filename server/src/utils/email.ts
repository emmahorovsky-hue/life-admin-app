import validator from 'validator';

/**
 * Email has two different jobs in this app, and conflating them is what caused
 * LIF-80 and its revert (87e886d):
 *
 *   display  — the address as the user typed it. Theirs, dots and all.
 *   identity — the key we look up and enforce uniqueness on. Gmail ignores
 *              dots, so one inbox must resolve to one account however it is
 *              spelled.
 *
 * `User.email` holds the first, `User.emailCanonical` the second.
 */

/**
 * The stored/displayed form: trimmed and lowercased, nothing else. Dots,
 * +subaddresses and googlemail.com all survive.
 *
 * Lowercasing the local part too (not just the domain) matches what
 * normalizeEmail's `all_lowercase` default already did to every historical
 * row, so display and canonical never disagree on case.
 */
export function displayEmail(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * The identity key. Reproduces express-validator's `.normalizeEmail()` with its
 * DEFAULT options — the exact function that produced every value ever written
 * to `User.email` before the display/identity split, which is what makes the
 * migration's backfill correct. Never pass options: the defaults ARE the
 * contract, and `utils/__tests__/email.test.ts` pins them so a `validator`
 * bump fails loudly instead of silently re-partitioning accounts.
 *
 *   gmail.com / googlemail.com  +subaddress and dots dropped, domain forced
 *                               to gmail.com
 *   outlook / hotmail / live    +subaddress dropped
 *   icloud.com / me.com         +subaddress dropped
 *   yahoo family                trailing -subaddress dropped
 *   yandex family               domain forced to yandex.ru
 *   everything else             lowercased only — DOTS ARE SIGNIFICANT, so
 *                               a.b@example.com and ab@example.com are two
 *                               different accounts
 *
 * Takes `unknown` because the rate-limiter key generator runs before any
 * validator and therefore sees whatever shape the request body had. Returns
 * null for anything that isn't a valid address; callers turn that into a 401 or
 * a generic 200 rather than a 500.
 */
export function canonicalEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null;

  // Trim before handing off: normalizeEmail does NOT trim, and a trailing
  // space leaves the domain as "gmail.com " which then misses the Gmail rules
  // entirely — you'd get a canonical form with the dots still in it.
  const trimmed = displayEmail(input);

  // normalizeEmail assumes it was handed something isEmail() already accepted:
  // it throws on a non-string and happily returns "@" for an empty string.
  // Gate on isEmail so every rejection lands here as null.
  if (!validator.isEmail(trimmed)) return null;

  const normalized = validator.normalizeEmail(trimmed);
  return normalized === false ? null : normalized;
}

/**
 * Both User columns from one address, so no call site can set one without the
 * other. Throws on an address that cannot be canonicalized — only call it after
 * isEmail() has passed in the validation chain, or with literal input in
 * tests, seeds and jobs.
 */
export function emailFields(input: string): { email: string; emailCanonical: string } {
  const emailCanonical = canonicalEmail(input);
  if (!emailCanonical) {
    throw new Error(`Cannot derive a canonical form from email: ${JSON.stringify(input)}`);
  }
  return { email: displayEmail(input), emailCanonical };
}
