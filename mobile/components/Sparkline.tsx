// ─────────────────────────────────────────────────────────────────────────────
// Sparkline (Dashboard 1b) — a minimal spend-trend line drawn with Skia.
//
// An ink polyline over the last N months of total monthly spend, with the final
// point marked by the screen's single brand-orange dot. Point math mirrors the
// handoff prototype: x spreads evenly across the width; y maps [min,max] into a
// PAD-inset band so the extremes never touch the edges.
// ─────────────────────────────────────────────────────────────────────────────

import { View } from 'react-native';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { colors } from '../lib/theme';

const PAD = 6; // vertical inset (matches the prototype's 6px top / bottom band)
const DOT_R = 4.5;

interface SparklineProps {
  /** Monthly spend values, oldest → newest. */
  data: number[];
  /** Full render width in px (parent computes from screen width). */
  width: number;
  height?: number;
}

export function Sparkline({ data, width, height = 72 }: SparklineProps) {
  // Nothing sensible to draw with <2 points or before layout gives us a width.
  if (data.length < 2 || width <= 0) return <View style={{ width, height }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1; // flat series → straight mid-line, no divide-by-zero
  const usable = height - PAD * 2;

  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: PAD + (1 - (v - min) / span) * usable,
  }));

  const path = Skia.Path.Make();
  path.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) path.lineTo(points[i].x, points[i].y);

  const last = points[points.length - 1];

  return (
    <Canvas style={{ width, height }}>
      <Path
        path={path}
        style="stroke"
        strokeWidth={2}
        strokeCap="round"
        strokeJoin="round"
        color={colors.foreground}
      />
      <Circle cx={last.x} cy={last.y} r={DOT_R} color={colors.brandOrange} />
    </Canvas>
  );
}
