import { describe, expect, it } from 'vitest';
import { compareVersions, whatsNewAction, type WhatsNewInput } from '@life-admin/shared';

// The logic behind the mobile "What's new" sheet (LIF-271). It lives in shared
// and is tested here because mobile has no test runner.

describe('compareVersions', () => {
  it('treats identical versions as equal', () => {
    expect(compareVersions('1.0.1', '1.0.1')).toBe(0);
  });

  it('orders by major, then minor, then patch', () => {
    expect(compareVersions('1.0.1', '1.0.2')).toBeLessThan(0);
    expect(compareVersions('1.1.0', '1.0.9')).toBeGreaterThan(0);
    expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0);
  });

  it('compares numerically, not as text', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
  });

  it('counts missing parts as zero', () => {
    expect(compareVersions('1.1', '1.1.0')).toBe(0);
    expect(compareVersions('2', '1.9.9')).toBeGreaterThan(0);
  });

  it('ignores a pre-release suffix', () => {
    expect(compareVersions('1.2.0-beta.1', '1.2.0')).toBe(0);
  });

  it('sorts an unparseable version as older than any real one', () => {
    expect(compareVersions('garbage', '0.0.1')).toBeLessThan(0);
    expect(compareVersions('1.0.0', '')).toBeGreaterThan(0);
  });
});

describe('whatsNewAction', () => {
  const base: WhatsNewInput = {
    stored: '1.0.1',
    current: '1.1.0',
    hasSubscriptions: true,
    hasNote: true,
  };

  it('shows the note after an upgrade', () => {
    expect(whatsNewAction(base)).toBe('show');
  });

  it('records a fresh install silently: nothing stored, no subscriptions', () => {
    expect(whatsNewAction({ ...base, stored: null, hasSubscriptions: false })).toBe('baseline');
  });

  it('treats nothing stored with subscriptions as an upgrade', () => {
    expect(whatsNewAction({ ...base, stored: null, hasSubscriptions: true })).toBe('show');
  });

  it('records the version when nothing is stored and there is no note to show', () => {
    expect(
      whatsNewAction({ ...base, stored: null, hasSubscriptions: true, hasNote: false }),
    ).toBe('baseline');
  });

  it('shows nothing once the current version has been seen', () => {
    expect(whatsNewAction({ ...base, stored: '1.1.0' })).toBe('none');
  });

  it('shows nothing when the stored version is newer (a downgrade)', () => {
    expect(whatsNewAction({ ...base, stored: '1.2.0' })).toBe('none');
  });

  it('shows nothing after an upgrade with no note for the new version', () => {
    expect(whatsNewAction({ ...base, hasNote: false })).toBe('none');
  });

  it('shows nothing when the running version cannot be read', () => {
    expect(whatsNewAction({ ...base, current: null })).toBe('none');
  });

  it('shows the note once when the stored value is corrupt', () => {
    expect(whatsNewAction({ ...base, stored: 'not-a-version' })).toBe('show');
  });
});
