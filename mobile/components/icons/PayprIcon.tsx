import Svg, { Circle, G, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import {
  ICON_GEOMETRY,
  ICON_DIRECTION_ROTATION,
  type IconName,
  type IconDirection,
  type IconInk,
  type IconPart,
} from '@life-admin/shared';
import { colors } from '../../lib/theme';

/**
 * Which colour the accent detail takes.
 *
 * `brand` (default) paints it orange. `inherit` makes the whole glyph one
 * colour — use it wherever the icon already sits on a tinted surface or is
 * itself tinted (a filled orange button, a white-on-orange badge), where a
 * second colour would only fight the first.
 */
export type Ink = 'brand' | 'inherit';

export interface PayprIconProps {
  size?: number;
  /**
   * The base colour. React Native has no `currentColor`, so unlike the web
   * build this is explicit — it mirrors the `color` prop of the `Ionicons`
   * call sites this set replaces.
   */
  color?: string;
  ink?: Ink;
  strokeWidth?: number;
}

interface PayprIconBaseProps extends PayprIconProps {
  name: IconName;
  /** Chevron only — a rotation of the one drawing, never a second drawing. */
  direction?: IconDirection;
}

/**
 * The React Native binding for the Paypr icon set. Geometry is shared with the
 * web client (`packages/shared/src/icons/geometry.ts`), so the two platforms
 * cannot drift; only the rendering primitive differs.
 */
export function PayprIcon({
  name,
  direction = 'right',
  size = 24,
  color = colors.foreground,
  ink = 'brand',
  strokeWidth = 1.5,
}: PayprIconBaseProps) {
  const accent = ink === 'inherit' ? color : colors.brandOrange;
  const rotation = ICON_DIRECTION_ROTATION[direction];

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      // The set's identity. Never soften these to `round`.
      strokeLinecap="butt"
      strokeLinejoin="miter"
    >
      <G rotation={rotation} origin="12, 12">
        {ICON_GEOMETRY[name].map((part, i) => renderPart(part, i, color, accent))}
      </G>
    </Svg>
  );
}

// `none` must be the literal string so it overrides the <Svg> stroke; omitting
// the prop would inherit it instead.
function paint(ink: IconInk | undefined, fallback: IconInk, color: string, accent: string): string {
  switch (ink ?? fallback) {
    case 'accent':
      return accent;
    case 'none':
      return 'none';
    default:
      return color;
  }
}

function renderPart(part: IconPart, key: number, color: string, accent: string) {
  const props = {
    stroke: paint(part.stroke, 'base', color, accent),
    fill: paint(part.fill, 'none', color, accent),
  };

  switch (part.el) {
    case 'path':
      return <Path key={key} d={part.d} {...props} />;
    case 'polyline':
      return <Polyline key={key} points={part.points} {...props} />;
    case 'polygon':
      return <Polygon key={key} points={part.points} {...props} />;
    case 'rect':
      return (
        <Rect key={key} x={part.x} y={part.y} width={part.width} height={part.height} {...props} />
      );
    case 'circle':
      return <Circle key={key} cx={part.cx} cy={part.cy} r={part.r} {...props} />;
  }
}
