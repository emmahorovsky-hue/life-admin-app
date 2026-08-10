import { describe, it, expect } from 'vitest';
import {
  PADDED,
  TIGHT,
  PHONE_FAMILY_BY_ASSET,
  phoneFamilyFor,
  phoneBox,
  DEVICE_SUBCARD,
} from './phoneAssets';

// `import.meta.glob` rather than fs, for the same reason themeRoutes.test.ts
// uses `?raw`: it resolves relative to this file at transform time, so the test
// does not depend on the working directory the runner was started from.
const ASSET_FILES = Object.keys(import.meta.glob('../../public/ios/*.webp')).map(
  (p) => p.split('/').pop() as string
);

describe('phoneAssets', () => {
  describe('PHONE_FAMILY_BY_ASSET', () => {
    // The guard that matters. The two crops put the device at very different
    // scales inside the same canvas, so an unclassified asset renders ~23% off
    // and lands on the wrong baseline. The e2e layout tests cannot catch it —
    // they read this same table.
    it('classifies every screenshot in public/ios', () => {
      expect(ASSET_FILES.length).toBeGreaterThan(0);
      expect([...ASSET_FILES].sort()).toEqual(Object.keys(PHONE_FAMILY_BY_ASSET).sort());
    });

    it('maps each asset to a family that is actually one of the two', () => {
      for (const family of Object.values(PHONE_FAMILY_BY_ASSET)) {
        expect([PADDED, TIGHT]).toContain(family);
      }
    });
  });

  describe('phoneFamilyFor', () => {
    it('resolves a page `src` path to its family', () => {
      expect(phoneFamilyFor('/ios/home.webp')).toBe(PADDED);
      expect(phoneFamilyFor('/ios/timeline.webp')).toBe(TIGHT);
      expect(phoneFamilyFor('/ios/notifications.webp')).toBe(TIGHT);
    });

    it('accepts a bare basename', () => {
      expect(phoneFamilyFor('details-sub.webp')).toBe(PADDED);
    });

    // Previously this returned PADDED and the phone silently rendered wrong.
    it('throws on an unclassified asset rather than guessing', () => {
      expect(() => phoneFamilyFor('/ios/new-screen.webp')).toThrow(/Unclassified phone asset/);
    });
  });

  describe('phoneBox', () => {
    // The whole point of specifying phones by device height: the same number
    // must produce the same physical phone in either family, even though the
    // image boxes around them differ.
    it('renders one device height as the same device across both families', () => {
      const padded = phoneBox(PADDED, DEVICE_SUBCARD);
      const tight = phoneBox(TIGHT, DEVICE_SUBCARD);

      expect(padded.height * PADDED.deviceHeightFrac).toBeCloseTo(DEVICE_SUBCARD, 1);
      expect(tight.height * TIGHT.deviceHeightFrac).toBeCloseTo(DEVICE_SUBCARD, 1);
    });

    it('gives the two families different image boxes for that same device', () => {
      const padded = phoneBox(PADDED, DEVICE_SUBCARD);
      const tight = phoneBox(TIGHT, DEVICE_SUBCARD);

      // ~23% — the bug that motivated the module.
      expect(padded.width / tight.width).toBeGreaterThan(1.2);
    });

    it('derives negative margins that collapse the transparent margin exactly', () => {
      const box = phoneBox(PADDED, DEVICE_SUBCARD);

      expect(box.height - box.padTop - box.padBottom).toBeCloseTo(DEVICE_SUBCARD, 1);
    });
  });
});
