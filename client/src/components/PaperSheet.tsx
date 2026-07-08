import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PAPER_TINT, PAPER_SHADOW, PAPER_MARGIN_RULE } from '@/lib/paper';

interface PaperSheetProps {
  /** Background cream tint. Defaults to the primary tint. */
  tint?: string;
  /** Tailwind left-offset for the red margin rule; should sit inside the left padding. */
  marginRuleClassName?: string;
  /** Classes for the content column (e.g. vertical spacing). */
  innerClassName?: string;
  /** Classes for the sheet itself (padding, rotation, …). */
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** A single "filed paper" sheet: cream surface, warm shadow, soft-red left margin rule. */
export function PaperSheet({
  tint = PAPER_TINT,
  marginRuleClassName = 'left-8',
  innerClassName,
  className,
  style,
  children,
}: PaperSheetProps) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-[3px] border border-black/[0.06]', className)}
      style={{ backgroundColor: tint, boxShadow: PAPER_SHADOW, ...style }}
    >
      {/* Left margin rule */}
      <span
        aria-hidden="true"
        className={cn('absolute top-0 bottom-0 w-px', marginRuleClassName)}
        style={{ background: PAPER_MARGIN_RULE }}
      />
      <div className={cn('relative', innerClassName)}>{children}</div>
    </div>
  );
}
