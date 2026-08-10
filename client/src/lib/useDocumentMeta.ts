/**
 * Per-route `<title>` and social-share metadata.
 *
 * `client/index.html` carries one fixed set of tags describing the product as a
 * whole, which is right for the app's own screens — they are behind auth and
 * nobody shares a link to them. It is wrong for a marketing route that exists to
 * be shared: without this hook `/mobile` previews as the homepage, with the
 * homepage's title and `og:url=https://paypr.live/`.
 *
 * **This is a client-side patch and crawlers that do not run JS see the static
 * tags in index.html.** Facebook, LinkedIn and iMessage do not execute the
 * bundle, so they will still show the homepage card. Fixing that properly means
 * prerendering the marketing routes at build time — a real change to how the
 * client deploys, and deliberately not attempted here. What this hook does buy
 * is the correct browser tab title, the correct bookmark name, and correct
 * metadata for Google (which does render JS).
 *
 * Tags are restored on unmount so an SPA navigation away from the route does not
 * leave its title behind.
 */

import { useEffect } from 'react';

export type DocumentMeta = {
  title: string;
  description: string;
  /** Absolute canonical URL for the route, e.g. `https://paypr.live/mobile`. */
  url?: string;
};

/** Every tag this hook touches, and which field of `DocumentMeta` fills it. */
const TAG_SELECTORS: ReadonlyArray<[keyof DocumentMeta, string]> = [
  ['title', 'meta[property="og:title"]'],
  ['title', 'meta[name="twitter:title"]'],
  ['description', 'meta[name="description"]'],
  ['description', 'meta[property="og:description"]'],
  ['description', 'meta[name="twitter:description"]'],
  ['url', 'meta[property="og:url"]'],
];

export function useDocumentMeta({ title, description, url }: DocumentMeta): void {
  useEffect(() => {
    const values: DocumentMeta = { title, description, url };

    const previousTitle = document.title;
    document.title = title;

    // Restorers are collected as closures rather than a map of selector →
    // value: a selector that matches nothing is simply skipped, so the hook is
    // safe if index.html drops a tag.
    const restore: Array<() => void> = [];

    for (const [field, selector] of TAG_SELECTORS) {
      const value = values[field];
      if (value === undefined) continue;

      const el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) continue;

      const previous = el.content;
      el.content = value;
      restore.push(() => {
        el.content = previous;
      });
    }

    return () => {
      document.title = previousTitle;
      for (const undo of restore) undo();
    };
  }, [title, description, url]);
}
