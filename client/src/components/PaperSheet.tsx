import type { CSSProperties, ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PAPER_TINT, PAPER_MARGIN_RULE } from '@/lib/paper';

type PaperSheetOwnProps<T extends ElementType> = {
  /** Element to render the sheet as, e.g. "button" for interactive cards. Defaults to "div". */
  as?: T;
  /** Background cream tint. Defaults to the primary tint. */
  tint?: string;
  /** Tailwind left-offset for the red margin rule; should sit inside the left padding. */
  marginRuleClassName?: string;
  /** Absolutely-positioned decoration painted behind the margin rule and content (e.g. horizontal ruling). */
  backdrop?: ReactNode;
  /** Classes for the content column (e.g. vertical spacing). */
  innerClassName?: string;
  /** Classes for the sheet itself (padding, rotation, …). */
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

type PaperSheetProps<T extends ElementType> = PaperSheetOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof PaperSheetOwnProps<T>>;

/** A single "filed paper" sheet: cream surface, warm shadow, soft-red left margin rule. */
export function PaperSheet<T extends ElementType = 'div'>({
  as,
  tint = PAPER_TINT,
  marginRuleClassName = 'left-8',
  backdrop,
  innerClassName,
  className,
  style,
  children,
  ...rest
}: PaperSheetProps<T>) {
  const Component: ElementType = as ?? 'div';
  return (
    <Component
      className={cn('paper-light relative overflow-hidden rounded-[3px] border border-black/[0.06] text-foreground', className)}
      // The cream tint drives the fill via a CSS var so dark mode can retune the
      // whole surface (see .paper-light / .dark .paper-light in index.css).
      style={{ '--paper-tint': tint, ...style } as CSSProperties}
      {...rest}
    >
      {backdrop}
      {/* Left margin rule */}
      <span
        aria-hidden="true"
        className={cn('absolute top-0 bottom-0 w-px', marginRuleClassName)}
        style={{ background: PAPER_MARGIN_RULE }}
      />
      <div className={cn('relative', innerClassName)}>{children}</div>
    </Component>
  );
}
