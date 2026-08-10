import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDocumentMeta } from './useDocumentMeta';

const HOME = {
  title: 'Paypr - Never miss a renewal',
  description: 'Track subscriptions, contracts, warranties, and leases on one timeline.',
  url: 'https://paypr.live/',
};

const ROUTE = {
  title: 'Paypr for iPhone',
  description: 'Catch a receipt the moment it lands.',
  url: 'https://paypr.live/mobile',
};

/**
 * Rebuild the subset of index.html's head that the hook patches.
 *
 * Order matters: `document.title = x` works by creating a `<title>` element, so
 * assigning it before replacing `head.innerHTML` would throw that element away
 * and leave `document.title` empty.
 */
function seedHead() {
  document.head.innerHTML = `
    <meta name="description" content="${HOME.description}" />
    <meta property="og:title" content="${HOME.title}" />
    <meta property="og:description" content="${HOME.description}" />
    <meta property="og:url" content="${HOME.url}" />
    <meta name="twitter:title" content="${HOME.title}" />
    <meta name="twitter:description" content="${HOME.description}" />
  `;
  document.title = HOME.title;
}

const content = (selector: string) =>
  document.head.querySelector<HTMLMetaElement>(selector)?.content;

describe('useDocumentMeta', () => {
  beforeEach(seedHead);
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('sets the document title', () => {
    renderHook(() => useDocumentMeta(ROUTE));

    expect(document.title).toBe(ROUTE.title);
  });

  it('patches the title, description and url across og and twitter', () => {
    renderHook(() => useDocumentMeta(ROUTE));

    expect(content('meta[property="og:title"]')).toBe(ROUTE.title);
    expect(content('meta[name="twitter:title"]')).toBe(ROUTE.title);
    expect(content('meta[name="description"]')).toBe(ROUTE.description);
    expect(content('meta[property="og:description"]')).toBe(ROUTE.description);
    expect(content('meta[name="twitter:description"]')).toBe(ROUTE.description);
    expect(content('meta[property="og:url"]')).toBe(ROUTE.url);
  });

  // Without this, navigating away inside the SPA leaves the route's title and
  // og:url behind — so a later share of a different page carries /mobile's card.
  it('restores every tag on unmount', () => {
    const { unmount } = renderHook(() => useDocumentMeta(ROUTE));
    unmount();

    expect(document.title).toBe(HOME.title);
    expect(content('meta[property="og:title"]')).toBe(HOME.title);
    expect(content('meta[name="twitter:description"]')).toBe(HOME.description);
    expect(content('meta[property="og:url"]')).toBe(HOME.url);
  });

  it('leaves og:url alone when the caller gives no url', () => {
    renderHook(() => useDocumentMeta({ title: ROUTE.title, description: ROUTE.description }));

    expect(content('meta[property="og:url"]')).toBe(HOME.url);
  });

  it('does not throw when index.html drops a tag it expects', () => {
    document.head.innerHTML = '';

    expect(() => renderHook(() => useDocumentMeta(ROUTE))).not.toThrow();
    expect(document.title).toBe(ROUTE.title);
  });
});
