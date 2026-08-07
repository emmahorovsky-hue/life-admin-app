import {
  ICON_GEOMETRY,
  ICON_DIRECTION_ROTATION,
  type IconName,
  type IconDirection,
  type IconInk,
  type IconPart,
} from '@life-admin/shared';

/**
 * Which colour the accent detail takes.
 *
 * `brand` (default) paints it orange. `inherit` makes the whole glyph one
 * colour — use it wherever the icon is *already* tinted and a second colour
 * would fight the tint: the active nav row (`text-brand-orange`), a
 * destructive button (white on orange), anything on a coloured surface.
 */
export type Ink = 'brand' | 'inherit';

// `name` and `direction` are both real SVG attributes, and both are used here
// with different meanings — omit them so the icon's own props win instead of
// being widened back to `string` by the spread.
export interface PayprIconProps extends Omit<React.SVGProps<SVGSVGElement>, 'name' | 'direction'> {
  size?: number;
  ink?: Ink;
}

interface PayprIconBaseProps extends PayprIconProps {
  name: IconName;
  /** Chevron only — a rotation of the one drawing, never a second drawing. */
  direction?: IconDirection;
}

/**
 * The shape every icon in the set shares. Matches lucide's call-site contract
 * closely enough to be a drop-in: `className`, `size`, `strokeWidth`,
 * `aria-hidden` and anything else spread onto the `<svg>`.
 *
 * `width`/`height` are set from `size` so `createElement(Icon, { size })` works
 * (SubscriptionLogo does exactly that), but the app mostly sizes icons with
 * Tailwind `h-4 w-4` — and CSS beats the presentation attributes, so both work
 * without fighting.
 */
export function PayprIcon({
  name,
  direction = 'right',
  size = 24,
  ink = 'brand',
  strokeWidth,
  ...rest
}: PayprIconBaseProps) {
  const accent = ink === 'inherit' ? 'currentColor' : 'hsl(var(--brand-orange))';
  const rotation = ICON_DIRECTION_ROTATION[direction];

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? 1.5}
      // The set's identity. Never soften these to `round`.
      strokeLinecap="butt"
      strokeLinejoin="miter"
      focusable="false"
      {...rest}
    >
      <g transform={rotation ? `rotate(${rotation} 12 12)` : undefined}>
        {ICON_GEOMETRY[name].map((part, i) => renderPart(part, i, accent))}
      </g>
    </svg>
  );
}

// `none` has to be the literal string so it overrides the <svg> element's
// stroke; omitting the attribute would inherit it instead.
function paint(ink: IconInk | undefined, fallback: IconInk, accent: string): string {
  switch (ink ?? fallback) {
    case 'accent':
      return accent;
    case 'none':
      return 'none';
    default:
      return 'currentColor';
  }
}

function renderPart(part: IconPart, key: number, accent: string) {
  const props = {
    stroke: paint(part.stroke, 'base', accent),
    fill: paint(part.fill, 'none', accent),
  };

  switch (part.el) {
    case 'path':
      return <path key={key} d={part.d} {...props} />;
    case 'polyline':
      return <polyline key={key} points={part.points} {...props} />;
    case 'polygon':
      return <polygon key={key} points={part.points} {...props} />;
    case 'rect':
      return (
        <rect key={key} x={part.x} y={part.y} width={part.width} height={part.height} {...props} />
      );
    case 'circle':
      return <circle key={key} cx={part.cx} cy={part.cy} r={part.r} {...props} />;
  }
}
