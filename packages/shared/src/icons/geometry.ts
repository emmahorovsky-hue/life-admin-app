// Paypr icon set — direction 1a, "Thermal Line".
//
// Geometry only. This module is deliberately data, not components: the web
// client renders it as SVG and mobile renders it through react-native-svg, and
// `packages/shared` must stay React-free (web is React 18, mobile React 19).
// Both platforms keep a thin renderer; the coordinates live here once so a
// tweak can't land on one platform and not the other.
//
// The contract, which is the identity of the set — do not relax any of it:
//   - 24×24 viewBox, live area 2.5–21.5
//   - 1.5px stroke, `butt` caps, `miter` joins, `fill: none`
//     NO ROUNDED CAPS ANYWHERE. That is the whole point.
//   - straight lines and 45° over curves; coordinates on a 0.25 grid wherever
//     the drawing allows. Eight icons (subscriptions, cloud, gaming, edit,
//     warning, theme, user) carry off-grid values at arc radii and diagonal
//     endpoints where snapping would visibly distort the glyph — this is a
//     preference, not a law, and `geometry.contract.test.ts` does not assert it
//   - exactly one brand-orange detail per icon; everything else inherits.
//     One accent *part*, not one accent region — an arrow whose shaft and head
//     are separate elements counts as two. Put them in one element as separate
//     subpaths; the rendering is identical under butt caps and miter joins
//
// Adding an icon: draw on the 24 grid, give it exactly one `accent` part, and
// add it here — both platforms pick it up from the `IconName` union.

/**
 * How a part is painted.
 * - `base`   — inherits (currentColor on web, the `color` prop on mobile)
 * - `accent` — the single brand-orange detail
 * - `none`   — not painted at all
 */
export type IconInk = 'base' | 'accent' | 'none';

/** Defaults, applied by the renderers: stroke `base`, fill `none`. */
interface PartInk {
  stroke?: IconInk;
  fill?: IconInk;
}

export type IconPart =
  | (PartInk & { el: 'path'; d: string })
  | (PartInk & { el: 'polyline'; points: string })
  | (PartInk & { el: 'polygon'; points: string })
  | (PartInk & { el: 'rect'; x: number; y: number; width: number; height: number })
  | (PartInk & { el: 'circle'; cx: number; cy: number; r: number });

// Written out per icon rather than generated: these are drawings, and a
// reviewer should be able to read the coordinates against the design.
export const ICON_GEOMETRY = {
  // ── Nav ──────────────────────────────────────────────────────────────
  dashboard: [
    { el: 'rect', x: 3.75, y: 3.75, width: 16.5, height: 16.5 },
    { el: 'path', d: 'M7.5 16.5V10' },
    { el: 'path', d: 'M12 16.5V7' },
    { el: 'path', d: 'M16.5 16.5V13', stroke: 'accent' },
  ],
  timeline: [
    { el: 'path', d: 'M7 3.5v17' },
    { el: 'path', d: 'M7 7.5h11' },
    { el: 'path', d: 'M7 12h8', stroke: 'accent' },
    { el: 'path', d: 'M7 16.5h12' },
  ],
  subscriptions: [
    { el: 'path', d: 'M4.25 12a7.75 7.75 0 0 1 13.2-5.5' },
    { el: 'polyline', points: '17.5 2.5 17.5 6.75 13.25 6.75', stroke: 'accent' },
    { el: 'path', d: 'M19.75 12a7.75 7.75 0 0 1-13.2 5.5' },
    { el: 'polyline', points: '6.5 21.5 6.5 17.25 10.75 17.25' },
  ],
  settings: [
    { el: 'path', d: 'M3.5 6.75h17' },
    { el: 'rect', x: 14, y: 4.75, width: 4, height: 4 },
    { el: 'path', d: 'M3.5 12h17' },
    { el: 'rect', x: 7, y: 10, width: 4, height: 4, stroke: 'accent', fill: 'accent' },
    { el: 'path', d: 'M3.5 17.25h17' },
    { el: 'rect', x: 12, y: 15.25, width: 4, height: 4 },
  ],
  logout: [
    { el: 'path', d: 'M14.5 3.75H4.5v16.5h10' },
    // Shaft and head are two subpaths of one element, not two elements. The
    // arrow is a single accent detail, and splitting it made the set's
    // one-accent-per-glyph rule read as broken by an icon that never broke it.
    // Pixel-identical: with butt caps and miter joins a subpath break draws
    // exactly like an element break.
    { el: 'path', d: 'M10.5 12h9.5M17 8.75L20.25 12L17 15.25', stroke: 'accent' },
  ],

  // ── Categories (the CATEGORY_ICONS map on both platforms) ────────────
  streaming: [
    { el: 'rect', x: 2.75, y: 4.75, width: 18.5, height: 12.5 },
    { el: 'path', d: 'M8 20.5h8' },
    { el: 'polygon', points: '10.5 8.75 15.5 11.75 10.5 14.75', stroke: 'none', fill: 'accent' },
  ],
  fitness: [
    { el: 'path', d: 'M8 12h8' },
    { el: 'rect', x: 4.75, y: 8, width: 3.25, height: 8 },
    { el: 'rect', x: 16, y: 8, width: 3.25, height: 8, stroke: 'accent', fill: 'accent' },
    { el: 'path', d: 'M2.75 9.75v4.5' },
    { el: 'path', d: 'M21.25 9.75v4.5' },
  ],
  software: [
    { el: 'polyline', points: '8.5 8 4.5 12 8.5 16' },
    { el: 'polyline', points: '15.5 8 19.5 12 15.5 16' },
    { el: 'path', d: 'M13.25 6.75 10.75 17.25', stroke: 'accent' },
  ],
  music: [
    { el: 'path', d: 'M9.75 16.5V6l8-1.75v10.5' },
    { el: 'rect', x: 6, y: 14.5, width: 3.75, height: 3.75 },
    { el: 'rect', x: 14, y: 12.75, width: 3.75, height: 3.75, stroke: 'accent', fill: 'accent' },
  ],
  cloud: [
    { el: 'path', d: 'M6.5 17.5h11a3.5 3.5 0 0 0 .3-7 5.25 5.25 0 0 0-10.2-1.1A3.55 3.55 0 0 0 6.5 17.5Z' },
    { el: 'rect', x: 10.9, y: 12, width: 2.4, height: 2.4, stroke: 'accent', fill: 'accent' },
  ],
  gaming: [
    { el: 'rect', x: 2.75, y: 7.25, width: 18.5, height: 9.5 },
    { el: 'path', d: 'M6.5 10.5v3.25' },
    { el: 'path', d: 'M4.9 12.1h3.2' },
    { el: 'rect', x: 15, y: 10.5, width: 2.5, height: 2.5, stroke: 'accent', fill: 'accent' },
    { el: 'rect', x: 11.75, y: 12.75, width: 2.25, height: 2.25 },
  ],
  productivity: [
    { el: 'rect', x: 2.75, y: 7.25, width: 18.5, height: 12 },
    { el: 'path', d: 'M8.5 7.25V4.5h7v2.75' },
    { el: 'path', d: 'M2.75 13h18.5' },
    { el: 'rect', x: 10.25, y: 11.5, width: 3.5, height: 3, stroke: 'accent', fill: 'accent' },
  ],
  card: [
    { el: 'rect', x: 2.75, y: 5.25, width: 18.5, height: 13.5 },
    { el: 'path', d: 'M2.75 9.5h18.5' },
    { el: 'rect', x: 5.5, y: 12.5, width: 4.5, height: 3.25, stroke: 'accent', fill: 'accent' },
  ],

  // ── Actions ──────────────────────────────────────────────────────────
  add: [
    { el: 'path', d: 'M12 4.5v15' },
    { el: 'path', d: 'M4.5 12h15', stroke: 'accent' },
  ],
  upload: [
    { el: 'path', d: 'M12 16.5V4.5' },
    { el: 'polyline', points: '7.5 9 12 4.5 16.5 9', stroke: 'accent' },
    { el: 'path', d: 'M4.25 15.5v4h15.5v-4' },
  ],
  scan: [
    { el: 'polyline', points: '3.5 8.5 3.5 3.75 8.25 3.75' },
    { el: 'polyline', points: '15.75 3.75 20.5 3.75 20.5 8.5' },
    { el: 'polyline', points: '20.5 15.5 20.5 20.25 15.75 20.25' },
    { el: 'polyline', points: '8.25 20.25 3.5 20.25 3.5 15.5' },
    { el: 'path', d: 'M3.5 12h17', stroke: 'accent' },
  ],
  search: [
    { el: 'circle', cx: 10.5, cy: 10.5, r: 6.25 },
    { el: 'path', d: 'M15.25 15.25 20.5 20.5', stroke: 'accent' },
  ],
  // Body + viewfinder hump + lens. The accent is the indicator lamp rather
  // than the lens: the lens is the mass of the glyph, and filling it orange at
  // 16px turns the icon into a blob.
  camera: [
    { el: 'path', d: 'M8.75 6.5V4.25h6.5V6.5' },
    { el: 'rect', x: 2.75, y: 6.5, width: 18.5, height: 12.75 },
    { el: 'circle', cx: 12, cy: 13, r: 4 },
    { el: 'rect', x: 17, y: 8.75, width: 1.75, height: 1.75, stroke: 'accent', fill: 'accent' },
  ],
  // A framed photo with a second frame behind it — the stack is what says
  // "pick an existing one" rather than "an image". The ridge is four 45°
  // segments, which is the set's preferred way to draw anything organic.
  gallery: [
    { el: 'path', d: 'M6.5 4.25h14.75v12.5' },
    { el: 'rect', x: 2.75, y: 7, width: 15, height: 12.25 },
    { el: 'polyline', points: '5 16.5 9 12.5 12.25 15.75 15.5 12.5' },
    { el: 'circle', cx: 14.25, cy: 10.25, r: 1.5, stroke: 'accent', fill: 'accent' },
  ],
  edit: [
    { el: 'path', d: 'M4 20h4.25L20 8.25 15.75 4 4 15.75V20Z' },
    { el: 'path', d: 'M13.75 6 18 10.25' },
    { el: 'polygon', points: '4 20 4 15.9 8.1 20', stroke: 'none', fill: 'accent' },
  ],
  delete: [
    { el: 'path', d: 'M4.5 7h15', stroke: 'accent' },
    { el: 'path', d: 'M9 7V4.25h6V7' },
    { el: 'path', d: 'M6.25 7v13h11.5V7' },
    { el: 'path', d: 'M10 10.5v6' },
    { el: 'path', d: 'M14 10.5v6' },
  ],
  close: [
    { el: 'path', d: 'M5 5 19 19' },
    { el: 'path', d: 'M19 5 5 19', stroke: 'accent' },
  ],
  check: [
    { el: 'path', d: 'M4.25 12.5 9.5 17.75', stroke: 'accent' },
    { el: 'path', d: 'M9.5 17.75 20 5.5' },
  ],

  // ── Status ───────────────────────────────────────────────────────────
  bell: [
    { el: 'path', d: 'M6 17.5V11a6 6 0 0 1 12 0v6.5' },
    { el: 'path', d: 'M3.75 17.5h16.5' },
    { el: 'path', d: 'M10 20.25h4', stroke: 'accent' },
  ],
  warning: [
    { el: 'polygon', points: '12 3.75 21.5 20.25 2.5 20.25' },
    { el: 'path', d: 'M12 9.5v5' },
    { el: 'rect', x: 10.9, y: 16.25, width: 2.2, height: 2.2, stroke: 'accent', fill: 'accent' },
  ],
  renewing: [
    { el: 'circle', cx: 12, cy: 12, r: 7.75 },
    { el: 'path', d: 'M12 7v5' },
    { el: 'path', d: 'M12 12h4', stroke: 'accent' },
  ],
  cancelled: [
    { el: 'circle', cx: 12, cy: 12, r: 8 },
    { el: 'path', d: 'M6.5 17.5 17.5 6.5', stroke: 'accent' },
  ],
  calendar: [
    { el: 'rect', x: 3.5, y: 5.5, width: 17, height: 15 },
    { el: 'path', d: 'M3.5 10h17' },
    { el: 'path', d: 'M8 3.25V7' },
    { el: 'path', d: 'M16 3.25V7' },
    { el: 'rect', x: 7, y: 12.75, width: 2.5, height: 2.5, stroke: 'accent', fill: 'accent' },
    { el: 'rect', x: 11.75, y: 12.75, width: 2.5, height: 2.5 },
  ],

  // ── Chrome ───────────────────────────────────────────────────────────
  menu: [
    { el: 'path', d: 'M3.5 6.75h17' },
    { el: 'path', d: 'M3.5 12h17' },
    { el: 'path', d: 'M3.5 17.25h11', stroke: 'accent' },
  ],
  // Drawn pointing right; the other three directions are a rotation on the
  // root element, not separate drawings (see the `direction` prop).
  chevron: [
    { el: 'path', d: 'M9 4.5 16.5 12' },
    { el: 'path', d: 'M16.5 12 9 19.5', stroke: 'accent' },
  ],
  theme: [
    { el: 'circle', cx: 12, cy: 12, r: 4.25, stroke: 'accent', fill: 'accent' },
    { el: 'path', d: 'M12 2.5v2.5' },
    { el: 'path', d: 'M12 19v2.5' },
    { el: 'path', d: 'M2.5 12H5' },
    { el: 'path', d: 'M19 12h2.5' },
    { el: 'path', d: 'M5.3 5.3 7 7' },
    { el: 'path', d: 'M17 17l1.7 1.7' },
    { el: 'path', d: 'M18.7 5.3 17 7' },
    { el: 'path', d: 'M7 17l-1.7 1.7' },
  ],
  user: [
    { el: 'circle', cx: 12, cy: 8.25, r: 4 },
    { el: 'path', d: 'M4.75 20.5a7.25 7.25 0 0 1 14.5 0' },
    { el: 'rect', x: 10.9, y: 16.9, width: 2.2, height: 2.2, stroke: 'accent', fill: 'accent' },
  ],
  receipt: [
    { el: 'rect', x: 4.75, y: 2.75, width: 14.5, height: 18.5 },
    { el: 'path', d: 'M7.75 7h8.5' },
    { el: 'path', d: 'M7.75 11h8.5' },
    { el: 'path', d: 'M7.75 15h5', stroke: 'accent' },
  ],
} satisfies Record<string, readonly IconPart[]>;

export type IconName = keyof typeof ICON_GEOMETRY;

/** Rotation applied to the root element, in degrees. */
export const ICON_DIRECTION_ROTATION = {
  right: 0,
  down: 90,
  left: 180,
  up: 270,
} as const;

export type IconDirection = keyof typeof ICON_DIRECTION_ROTATION;
