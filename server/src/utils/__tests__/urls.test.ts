import { clientUrl, mobileUrl } from '../urls';

// These helpers exist to normalize and to supply a safe default, and neither
// behaviour runs anywhere else in the suite: `setup.ts` pins CLIENT_URL to
// localhost for every test file, so the production fallback never executes, and
// the LIF-244 regression test asserts only that the reset link is http(s) —
// which passes under either default. A wrong default here would email real
// users links to the wrong origin, silently. So exercise them directly.
describe('urls', () => {
  const original = {
    CLIENT_URL: process.env.CLIENT_URL,
    MOBILE_URL: process.env.MOBILE_URL,
  };

  // Assigning `undefined` to process.env stringifies it to "undefined", which
  // is truthy and would poison later tests — delete the key instead.
  afterEach(() => {
    (Object.keys(original) as (keyof typeof original)[]).forEach((key) => {
      const value = original[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  });

  describe('clientUrl', () => {
    it.each([
      ['unset', undefined],
      ['empty', ''],
    ])('falls back to the production origin when %s', (_label, value) => {
      if (value === undefined) delete process.env.CLIENT_URL;
      else process.env.CLIENT_URL = value;

      expect(clientUrl()).toBe('https://paypr.live');
    });

    it.each([
      ['https://example.com/', 'https://example.com'],
      ['https://example.com///', 'https://example.com'],
      ['https://example.com', 'https://example.com'],
    ])('normalizes %s to %s', (configured, expected) => {
      process.env.CLIENT_URL = configured;

      expect(clientUrl()).toBe(expected);
    });
  });

  describe('mobileUrl', () => {
    it.each([
      ['unset', undefined],
      ['empty', ''],
    ])('falls back to the app scheme when %s', (_label, value) => {
      if (value === undefined) delete process.env.MOBILE_URL;
      else process.env.MOBILE_URL = value;

      expect(mobileUrl()).toBe('lifeadmin://');
    });

    // The trailing slash is load-bearing: callers concatenate a bare path onto
    // this, so a scheme configured without one would yield `lifeadmin:/profile`.
    it.each([
      ['myapp://', 'myapp://'],
      ['myapp:/', 'myapp:/'],
      ['myapp', 'myapp/'],
    ])('normalizes %s to %s', (configured, expected) => {
      process.env.MOBILE_URL = configured;

      expect(mobileUrl()).toBe(expected);
    });
  });

  // The pair that motivated the refactor: one variable, two call sites, and
  // before LIF-244 two different defaults between them.
  it('reads env at call time, so a change mid-process is picked up', () => {
    process.env.CLIENT_URL = 'https://first.example';
    expect(clientUrl()).toBe('https://first.example');

    process.env.CLIENT_URL = 'https://second.example';
    expect(clientUrl()).toBe('https://second.example');
  });
});
