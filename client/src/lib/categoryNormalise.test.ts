import { describe, it, expect } from 'vitest';
import { normaliseCategory, CATEGORY_IDS, CATEGORIES } from '@life-admin/shared';

// normaliseCategory resolves arbitrary input to a CategoryId, or null. It exists
// because the receipt-extraction path used to require an exact id match and silently
// fell back to `other` otherwise, so a scanned "Cloud Storage" subscription was
// written to the database as `other` and vanished from its own filter (LIF-241).

describe('normaliseCategory', () => {
  it.each([
    'cloud',
    'Cloud',
    'CLOUD',
    ' cloud ',
    'Cloud Storage',
    'cloud storage',
    'CLOUD STORAGE',
    'cloud-storage',
    'cloud_storage',
    '  Cloud   Storage  ',
  ])('resolves %p to "cloud"', (input) => {
    expect(normaliseCategory(input)).toBe('cloud');
  });

  // The guard that keeps a newly-added category from quietly losing name-matching:
  // both an id and its display name must always round-trip to that id.
  it('round-trips every category id', () => {
    for (const id of CATEGORY_IDS) {
      expect(normaliseCategory(id)).toBe(id);
    }
  });

  it('round-trips every category display name', () => {
    for (const { id, name } of CATEGORIES) {
      expect(normaliseCategory(name)).toBe(id);
    }
  });

  it('resolves a genuine "other" rather than treating it as unrecognised', () => {
    expect(normaliseCategory('other')).toBe('other');
    expect(normaliseCategory('Other')).toBe('other');
  });

  it.each(['crypto', 'entertainment', 'news', ''])('returns null for the unknown value %p', (input) => {
    expect(normaliseCategory(input)).toBeNull();
  });

  it.each([undefined, null, 42, {}, [], true])('returns null for the non-string %p', (input) => {
    expect(normaliseCategory(input)).toBeNull();
  });

  it('returns null for whitespace only', () => {
    expect(normaliseCategory('   ')).toBeNull();
  });

  // No fuzzy matching, on purpose: guessing here would swap a silently-wrong `other`
  // for a silently-wrong *something else*, which is harder to spot and harder to undo.
  it.each(['cloud backup', 'cloudy', 'storage', 'my cloud storage plan'])(
    'does not fuzzy-match %p',
    (input) => {
      expect(normaliseCategory(input)).toBeNull();
    }
  );
});
