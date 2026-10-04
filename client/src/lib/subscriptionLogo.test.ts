import { afterEach, describe, expect, it, vi } from 'vitest';
import { IconProductivity, IconCard, IconFitness } from '@/components/icons';
import { SUBSCRIPTION_SUGGESTIONS } from '@life-admin/shared';
import { categoryIconFor, domainForName, logoUrlForName } from './subscriptionLogo';

describe('domainForName', () => {
  it('resolves known multi-word / non-.com brands via the alias map', () => {
    expect(domainForName('Disney+')).toBe('disneyplus.com');
    expect(domainForName('amazon prime')).toBe('amazon.com');
    expect(domainForName('iCloud')).toBe('apple.com');
    expect(domainForName('Xbox Game Pass')).toBe('xbox.com');
  });

  it('collapses an arbitrary name to "<alnum>.com"', () => {
    expect(domainForName('Netflix')).toBe('netflix.com');
    expect(domainForName('  Spotify  ')).toBe('spotify.com');
    expect(domainForName('My Local Gym')).toBe('mylocalgym.com');
  });

  it('maps brands whose name does not collapse to their own site', () => {
    // "chatgptplus.com" belongs to someone else, and logo.dev serves its logo.
    expect(domainForName('ChatGPT Plus')).toBe('chatgpt.com');
    expect(domainForName('ChatGPT')).toBe('chatgpt.com');
    expect(domainForName('chatgpt pro')).toBe('chatgpt.com');
    expect(domainForName('Gomo')).toBe('gomo.sg');
  });

  it('resolves every onboarding catalog service to its vetted domain', () => {
    // A new catalog entry must be added here, so it can't silently fall into
    // the "<name>.com" guess and pick up some other company's logo.
    const expected: Record<string, string> = {
      Netflix: 'netflix.com',
      'Disney+': 'disneyplus.com',
      'YouTube Premium': 'youtube.com',
      Spotify: 'spotify.com',
      'Apple Music': 'apple.com',
      'Adobe Creative Cloud': 'adobe.com',
      Figma: 'figma.com',
      GitHub: 'github.com',
      Notion: 'notion.com',
      'ChatGPT Plus': 'chatgpt.com',
      Dropbox: 'dropbox.com',
      'iCloud+': 'apple.com',
      'Xbox Game Pass': 'xbox.com',
      'PlayStation Plus': 'playstation.com',
      Peloton: 'peloton.com',
      ClassPass: 'classpass.com',
    };
    const resolved = Object.fromEntries(
      SUBSCRIPTION_SUGGESTIONS.map((s) => [s.name, domainForName(s.name)])
    );
    expect(resolved).toEqual(expected);
  });

  it('returns null for empty / punctuation-only names', () => {
    expect(domainForName('')).toBeNull();
    expect(domainForName('   ')).toBeNull();
    expect(domainForName('!!!')).toBeNull();
  });
});

describe('logoUrlForName', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('returns null when no token is configured', () => {
    vi.stubEnv('VITE_LOGO_DEV_TOKEN', '');
    expect(logoUrlForName('Netflix')).toBeNull();
  });

  it('builds a logo.dev URL with the token when configured', () => {
    vi.stubEnv('VITE_LOGO_DEV_TOKEN', 'pk_test');
    const url = logoUrlForName('Netflix');
    expect(url).toContain('https://img.logo.dev/netflix.com?');
    expect(url).toContain('token=pk_test');
    expect(url).toContain('size=128');
    expect(url).toContain('format=png');
    expect(url).toContain('fallback=404');
  });

  it('returns null for an unresolvable name even with a token', () => {
    vi.stubEnv('VITE_LOGO_DEV_TOKEN', 'pk_test');
    expect(logoUrlForName('   ')).toBeNull();
  });
});

describe('categoryIconFor', () => {
  it('maps known category ids to their icon', () => {
    expect(categoryIconFor('fitness')).toBe(IconFitness);
    expect(categoryIconFor('productivity')).toBe(IconProductivity);
  });

  it('falls back to the "other" icon for unknown categories', () => {
    expect(categoryIconFor('other')).toBe(IconCard);
    expect(categoryIconFor('nonexistent')).toBe(IconCard);
  });
});
