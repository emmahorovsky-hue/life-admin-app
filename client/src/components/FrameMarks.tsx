// ─────────────────────────────────────────────────────────────────────────────
// FrameMarks — the Vercel-style rails-and-registration-marks vocabulary the
// marketing pages are framed with: a hairline `Rule` between sections with a
// "+" where it crosses each rail, and `FrameCorners` for a framed block.
//
// Extracted from Landing.tsx so `/` and `/mobile` draw the same marks rather than
// each rolling their own. The tone values (and why there are two) live in
// lib/frameTone.ts — this module only exports components, so fast refresh keeps
// working.
// ─────────────────────────────────────────────────────────────────────────────

import {
  type FrameTone,
  FRAME_ARM_CLASS as ARM,
  FRAME_HAIRLINE_CLASS as HAIRLINE,
} from '@/lib/frameTone';

/** Small crosshair "+" mark, sits where rails meet a divider. */
export function Plus({ tone = 'default' }: { tone?: FrameTone }) {
  return (
    <span className="pointer-events-none relative block h-3 w-3">
      <span className={`absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 ${ARM[tone]}`} />
      <span className={`absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 ${ARM[tone]}`} />
    </span>
  );
}

/**
 * Divider between sections. The hairline runs full-bleed past the rails
 * (w-screen, centred on the frame), with a "+" mark where it crosses each rail.
 * Must be a direct child of the railed frame — the marks are positioned against
 * its edges.
 */
export function Rule({ tone = 'default' }: { tone?: FrameTone }) {
  return (
    <div className="relative z-30 h-px w-full" aria-hidden="true">
      <div className={`absolute left-1/2 top-0 h-px w-screen -translate-x-1/2 ${HAIRLINE[tone]}`} />
      <span className="absolute -left-[6px] -top-[6px]">
        <Plus tone={tone} />
      </span>
      <span className="absolute -right-[6px] -top-[6px]">
        <Plus tone={tone} />
      </span>
    </div>
  );
}

/**
 * Registration "+" marks pinned to the four corners of a framed block.
 * Parent must be `relative`.
 */
export function FrameCorners({ tone = 'default' }: { tone?: FrameTone }) {
  return (
    <span aria-hidden="true" className="pointer-events-none">
      <span className="absolute -left-[6px] -top-[6px]">
        <Plus tone={tone} />
      </span>
      <span className="absolute -right-[6px] -top-[6px]">
        <Plus tone={tone} />
      </span>
      <span className="absolute -left-[6px] -bottom-[6px]">
        <Plus tone={tone} />
      </span>
      <span className="absolute -right-[6px] -bottom-[6px]">
        <Plus tone={tone} />
      </span>
    </span>
  );
}
