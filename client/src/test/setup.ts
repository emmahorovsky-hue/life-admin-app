// Registers @testing-library/jest-dom matchers (e.g. toBeInTheDocument) on
// Vitest's expect, and auto-cleans the DOM between tests.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom ships no IntersectionObserver, and framer-motion throws outright when a
// `whileInView` element mounts without one — so any test rendering a component
// that uses scroll reveals fails on construction, before it can assert anything.
//
// The stub reports every observed element as immediately intersecting, which
// settles `whileInView` on its final (revealed) state. That is the right default
// for assertions: tests care about the content, not the entrance animation, and
// the alternative — elements stuck at their `initial` opacity — would make
// queries pass or fail based on animation timing.
if (!('IntersectionObserver' in globalThis)) {
  class ImmediateIntersectionObserver implements IntersectionObserver {
    readonly root: Document | Element | null = null;
    readonly rootMargin: string = '';
    readonly thresholds: ReadonlyArray<number> = [];

    constructor(private readonly callback: IntersectionObserverCallback) {}

    observe(target: Element): void {
      this.callback(
        [
          {
            target,
            isIntersecting: true,
            intersectionRatio: 1,
            boundingClientRect: target.getBoundingClientRect(),
            intersectionRect: target.getBoundingClientRect(),
            rootBounds: null,
            time: 0,
          } as IntersectionObserverEntry,
        ],
        this
      );
    }

    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  globalThis.IntersectionObserver =
    ImmediateIntersectionObserver as unknown as typeof IntersectionObserver;
}

afterEach(() => {
  cleanup();
});
