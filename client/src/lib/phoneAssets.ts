/**
 * Measured facts about the iPhone screenshots in `public/ios/`, and the sizing
 * they drive on the `/mobile` marketing page.
 *
 * The assets come in two crops, and they differ enough to matter:
 *
 *   1334x2504 sources → 760x1427 webp, device occupies 626x1294 (90.7% tall)
 *   1081x2271 sources → 760x1597 webp, device occupies 759x1596 (99.9% tall)
 *
 * Figures are from the assets' alpha channel, counting only solid pixels so the
 * baked-in shadow is excluded. The consequence is that sizing a shot by its
 * *image* width renders the same physical phone ~23% larger in the tight
 * family, and bottom-aligning two shots aligns their canvases while leaving the
 * devices on different baselines.
 *
 * So every phone on the page is specified as a **device height** and the image
 * box is derived from it. (This is also why the design handoff's "size by
 * height ≈413px tall" note doesn't work — that is the canvas height, and the
 * canvas is precisely what differs between the two families.)
 *
 * Lives outside the page component so the e2e test that guards the alignment
 * reads the same numbers rather than duplicating them.
 */

export type PhoneFamily = {
  /** Rendered height ÷ width of the whole asset, transparent margin included. */
  aspect: number;
  /** Device height ÷ rendered image width. */
  deviceHeightPerWidth: number;
  /** Device width ÷ rendered image width. */
  deviceWidthFrac: number;
  /** Device height ÷ rendered image height. */
  deviceHeightFrac: number;
  /** Transparent margin above the device, as a fraction of rendered height. */
  padTopFrac: number;
  /** Transparent margin below it. Not equal to the top — the crop isn't centred. */
  padBottomFrac: number;
};

/** The looser crop: ~9% of the canvas height is transparent margin. */
export const PADDED: PhoneFamily = {
  aspect: 1427 / 760,
  deviceHeightPerWidth: 1294 / 760,
  deviceWidthFrac: 626 / 760,
  deviceHeightFrac: 1294 / 1427,
  padTopFrac: 51 / 1427,
  padBottomFrac: 82 / 1427,
};

/** The tight crop: the device fills the canvas edge to edge. */
export const TIGHT: PhoneFamily = {
  aspect: 1597 / 760,
  deviceHeightPerWidth: 1596 / 760,
  deviceWidthFrac: 759 / 760,
  deviceHeightFrac: 1596 / 1597,
  padTopFrac: 0,
  padBottomFrac: 1 / 1597,
};

/**
 * Every asset in `public/ios/`, classified. Exhaustive on purpose: this started
 * as a regex over the filename with `PADDED` as a silent fallback, which meant a
 * new tight-crop asset whose name didn't happen to contain "timeline" or
 * "notifications" would render ~23% off — the exact failure this module exists
 * to prevent, arriving silently.
 *
 * `phoneAssets.test.ts` asserts this covers every `public/ios/*.webp`, so adding
 * a screenshot without classifying it fails a unit test rather than shipping.
 * Measure a new one off its alpha channel (solid pixels only, so the baked-in
 * shadow is excluded) before assuming which family it belongs to.
 */
export const PHONE_FAMILY_BY_ASSET: Readonly<Record<string, PhoneFamily>> = {
  'home.webp': PADDED,
  'uploading.webp': PADDED,
  'push.webp': PADDED,
  'subscriptions.webp': PADDED,
  'details-sub.webp': PADDED,
  'timeline.webp': TIGHT,
  'notifications.webp': TIGHT,
};

/**
 * Which family an asset belongs to, given a `src` such as `/ios/home.webp`.
 *
 * Throws on an unknown asset rather than guessing. A marketing page that fails
 * loudly in dev and in tests is worth more than one that quietly renders a phone
 * at the wrong scale in production.
 */
export function phoneFamilyFor(src: string): PhoneFamily {
  const basename = src.split('/').pop() ?? src;
  const family = PHONE_FAMILY_BY_ASSET[basename];
  if (!family) {
    throw new Error(
      `Unclassified phone asset "${basename}". Measure its crop and add it to ` +
        'PHONE_FAMILY_BY_ASSET in lib/phoneAssets.ts.'
    );
  }
  return family;
}

// Device heights by the role the shot plays. Two shots sharing a row share one
// of these, which is what keeps their devices optically identical.
export const DEVICE_HERO = 562;
export const DEVICE_BIG = 511; // the big centred shot in Sections A and B
export const DEVICE_CARD = 392; // the intro 2-up
export const DEVICE_SUBCARD = 375; // Section A's 2-up
export const DEVICE_PANEL = 504; // the notifications split

/** Ceiling on device width as a share of the viewport, for phones. */
export const DEVICE_VW_CAP = 59;

/**
 * The image box for a phone shown at `deviceHeight`, plus the negative margins
 * that collapse its transparent margin so the element lays out as the device.
 */
export function phoneBox(family: PhoneFamily, deviceHeight: number) {
  const width = deviceHeight / family.deviceHeightPerWidth;
  const height = width * family.aspect;
  return {
    width,
    height,
    padTop: height * family.padTopFrac,
    padBottom: height * family.padBottomFrac,
    /** Cap the device's width, not the image's, or the margin reintroduces the mismatch. */
    vwCap: DEVICE_VW_CAP / family.deviceWidthFrac,
  };
}
