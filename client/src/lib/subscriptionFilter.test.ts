import { describe, it, expect } from 'vitest';
import { matchesSubscriptionFilter, ALL_CATEGORIES } from '@life-admin/shared';

// The subscriptions-list filter predicate, shared by the web page and the mobile
// screen (LIF-241). It used to be copy-pasted into both, untested on either — and
// mobile has no test runner, so its copy could not be covered at all.

const sub = (name: string, category: string) => ({ name, category });

describe('matchesSubscriptionFilter', () => {
  describe('category', () => {
    it('matches every category when the filter is ALL_CATEGORIES', () => {
      for (const category of ['streaming', 'cloud', 'other']) {
        expect(
          matchesSubscriptionFilter({
            subscription: sub('Anything', category),
            searchTerm: '',
            categoryFilter: ALL_CATEGORIES,
          })
        ).toBe(true);
      }
    });

    it('matches on an exact category id', () => {
      expect(
        matchesSubscriptionFilter({
          subscription: sub('Dropbox', 'cloud'),
          searchTerm: '',
          categoryFilter: 'cloud',
        })
      ).toBe(true);
    });

    it('excludes a subscription in a different category', () => {
      expect(
        matchesSubscriptionFilter({
          subscription: sub('Netflix', 'streaming'),
          searchTerm: '',
          categoryFilter: 'cloud',
        })
      ).toBe(false);
    });

    // The shape of the reported bug: a cloud service stored as `other` is absent
    // from a Cloud Storage filter, and that is the filter behaving correctly. The
    // defect was upstream, in what got written to the database.
    it('excludes a cloud service that was stored as "other"', () => {
      expect(
        matchesSubscriptionFilter({
          subscription: sub('Dropbox', 'other'),
          searchTerm: '',
          categoryFilter: 'cloud',
        })
      ).toBe(false);
    });
  });

  describe('search', () => {
    it('matches a case-insensitive substring of the name', () => {
      for (const searchTerm of ['flix', 'NETFLIX', 'NeTf']) {
        expect(
          matchesSubscriptionFilter({
            subscription: sub('Netflix', 'streaming'),
            searchTerm,
            categoryFilter: ALL_CATEGORIES,
          })
        ).toBe(true);
      }
    });

    it('matches everything on an empty search term', () => {
      expect(
        matchesSubscriptionFilter({
          subscription: sub('Netflix', 'streaming'),
          searchTerm: '',
          categoryFilter: ALL_CATEGORIES,
        })
      ).toBe(true);
    });

    it('excludes a name that does not contain the term', () => {
      expect(
        matchesSubscriptionFilter({
          subscription: sub('Netflix', 'streaming'),
          searchTerm: 'dropbox',
          categoryFilter: ALL_CATEGORIES,
        })
      ).toBe(false);
    });
  });

  describe('composition', () => {
    it('requires both search and category to hold', () => {
      const dropbox = sub('Dropbox', 'cloud');
      expect(
        matchesSubscriptionFilter({ subscription: dropbox, searchTerm: 'drop', categoryFilter: 'cloud' })
      ).toBe(true);
      // right name, wrong category
      expect(
        matchesSubscriptionFilter({ subscription: dropbox, searchTerm: 'drop', categoryFilter: 'streaming' })
      ).toBe(false);
      // right category, wrong name
      expect(
        matchesSubscriptionFilter({ subscription: dropbox, searchTerm: 'netflix', categoryFilter: 'cloud' })
      ).toBe(false);
    });
  });

  // These pin behaviour that was deliberately preserved when the predicate moved out
  // of the two screens. They are not describing desirable behaviour so much as making
  // a future change to it argue with a test first.
  describe('preserved quirks', () => {
    it('does not trim the search term', () => {
      expect(
        matchesSubscriptionFilter({
          subscription: sub('Netflix', 'streaming'),
          searchTerm: '  netflix  ',
          categoryFilter: ALL_CATEGORIES,
        })
      ).toBe(false);
    });

    it('does not accept a category display name as the filter value', () => {
      // The filter value always comes from a `cat.id` in the picker, never from user
      // text, so normalising it here would add risk for no benefit.
      expect(
        matchesSubscriptionFilter({
          subscription: sub('Dropbox', 'cloud'),
          searchTerm: '',
          categoryFilter: 'Cloud Storage',
        })
      ).toBe(false);
    });
  });
});
