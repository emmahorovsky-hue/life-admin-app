import { describe, it, expect } from 'vitest';
import { ICON_GEOMETRY, type IconName, type IconPart } from '@life-admin/shared';

/**
 * The Paypr icon set states its contract as prose, in the header of
 * `packages/shared/src/icons/geometry.ts` and again in `client/docs/COMPONENTS.md`.
 * Prose does not fail a build, and the set had already drifted from two of its
 * own rules by the time it was first reviewed.
 *
 * These are the rules that hold across all 33 icons and are worth defending.
 * Deliberately NOT asserted: the "every coordinate on a 0.25 grid" rule. Eight
 * icons predate it — arc radii and 45° endpoints where the grid is genuinely
 * awkward — so the geometry header documents it as a preference rather than a
 * law. Tightening the drawings and then this test is a separate piece of work.
 *
 * `smoke.test.tsx` covers the rendered output; this covers the data behind it,
 * including the parts of it mobile draws, which has no test suite of its own.
 */

const LIVE_AREA_MIN = 2.5;
const LIVE_AREA_MAX = 21.5;

const entries = Object.entries(ICON_GEOMETRY) as [IconName, readonly IconPart[]][];

/** Absolute points a part occupies, for the commands the set actually uses. */
function pointsOf(part: IconPart): [number, number][] {
  if (part.el === 'rect') {
    return [
      [part.x, part.y],
      [part.x + part.width, part.y + part.height],
    ];
  }
  if (part.el === 'circle') {
    return [
      [part.cx - part.r, part.cy - part.r],
      [part.cx + part.r, part.cy + part.r],
    ];
  }
  if (part.el === 'polyline' || part.el === 'polygon') {
    const n = (part.points.match(/-?\d*\.?\d+/g) ?? []).map(Number);
    const pts: [number, number][] = [];
    for (let i = 0; i < n.length; i += 2) pts.push([n[i], n[i + 1]]);
    return pts;
  }

  // path: walk the command list, tracking absolute position. M/L/H/V/A/Z, both
  // cases — checked against the set's actual command vocabulary.
  const toks = part.d.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? [];
  const pts: [number, number][] = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let cmd = '';
  let i = 0;
  const next = () => Number(toks[i++]);

  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case 'M':
        x = rel ? x + next() : next();
        y = rel ? y + next() : next();
        startX = x;
        startY = y;
        pts.push([x, y]);
        // Coordinate pairs after an M are implicit linetos.
        cmd = rel ? 'l' : 'L';
        break;
      case 'L':
        x = rel ? x + next() : next();
        y = rel ? y + next() : next();
        pts.push([x, y]);
        break;
      case 'H':
        x = rel ? x + next() : next();
        pts.push([x, y]);
        break;
      case 'V':
        y = rel ? y + next() : next();
        pts.push([x, y]);
        break;
      case 'A':
        next(); next(); next(); next(); next(); // rx ry x-rotation large-arc sweep
        x = rel ? x + next() : next();
        y = rel ? y + next() : next();
        pts.push([x, y]);
        break;
      case 'Z':
        x = startX;
        y = startY;
        break;
      default:
        i++; // unknown command: skip rather than loop forever
    }
  }
  return pts;
}

describe('icon geometry contract', () => {
  it('gives every icon exactly one accent detail', () => {
    const offenders = entries
      .map(([name, parts]) => {
        const accents = parts.filter((p) => p.stroke === 'accent' || p.fill === 'accent').length;
        return { name, accents };
      })
      .filter(({ accents }) => accents !== 1);

    // One accent *part*, not one accent region: an arrow whose shaft and head
    // are separate elements is two parts and reads as a violation, so those go
    // in one element as separate subpaths (see `logout`).
    expect(offenders).toEqual([]);
  });

  it('keeps every drawn point inside the 2.5-21.5 live area', () => {
    const offenders: string[] = [];
    for (const [name, parts] of entries) {
      for (const part of parts) {
        for (const [x, y] of pointsOf(part)) {
          if (x < LIVE_AREA_MIN || x > LIVE_AREA_MAX || y < LIVE_AREA_MIN || y > LIVE_AREA_MAX) {
            offenders.push(`${name} (${part.el}): ${x}, ${y}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('draws every icon from at least one part', () => {
    expect(entries.filter(([, parts]) => parts.length === 0)).toEqual([]);
  });
});
