import { afterEach, describe, expect, it, vi } from 'vitest';
import { Briefcase, CreditCard, Dumbbell } from 'lucide-react';
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
    expect(url).toContain('size=64');
    expect(url).toContain('format=png');
  });

  it('returns null for an unresolvable name even with a token', () => {
    vi.stubEnv('VITE_LOGO_DEV_TOKEN', 'pk_test');
    expect(logoUrlForName('   ')).toBeNull();
  });
});

describe('categoryIconFor', () => {
  it('maps known category ids to their icon', () => {
    expect(categoryIconFor('fitness')).toBe(Dumbbell);
    expect(categoryIconFor('productivity')).toBe(Briefcase);
  });

  it('falls back to the "other" icon for unknown categories', () => {
    expect(categoryIconFor('other')).toBe(CreditCard);
    expect(categoryIconFor('nonexistent')).toBe(CreditCard);
  });
});
