import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PaperSheet } from '@/components/PaperSheet';
import { PayprMark } from '@/components/PayprMark';
import { PAPER_RULING } from '@/lib/paper';

type EmptyStateTone = 'sheet' | 'inline';

interface EmptyStateProps {
  /**
   * `sheet` (default) renders a standalone filed-paper sheet — use where the
   * empty state owns a page region (e.g. in place of the Subscriptions grid).
   * `inline` is a compact, surface-less block for dropping inside an existing
   * card (e.g. the Dashboard category chart) without a competing frame.
   */
  tone?: EmptyStateTone;
  /**
   * Leading visual. Defaults to the Paypr mark. Pass a node to override (e.g. a
   * search icon for a filtered/no-results state), or `null` to omit it.
   */
  icon?: ReactNode;
  /** Optional Space Mono eyebrow above the title. */
  kicker?: string;
  title: string;
  description?: string;
  /** Optional primary action (typically a `<Button>`). */
  action?: ReactNode;
  className?: string;
}

/**
 * The one on-brand empty state for the app — first-run, no-results and
 * "all caught up" moments all resolve to this. Keeps copy, spacing and the
 * brand mark consistent so no page hand-rolls its own "nothing here yet".
 */
export function EmptyState({
  tone = 'sheet',
  icon,
  kicker,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const leading = icon === undefined ? <PayprMark size={44} /> : icon;

  const content = (
    <div className="flex flex-col items-center gap-4 text-center">
      {leading}
      <div className="flex flex-col items-center gap-1.5">
        {kicker && (
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
            {kicker}
          </p>
        )}
        <h3
          className={cn(
            'font-sans font-bold tracking-tight text-foreground',
            tone === 'sheet' ? 'text-lg' : 'text-base'
          )}
        >
          {title}
        </h3>
        {description && (
          <p className="max-w-[34ch] text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );

  if (tone === 'inline') {
    return (
      <div className={cn('flex flex-col items-center justify-center py-10', className)}>
        {content}
      </div>
    );
  }

  return (
    <PaperSheet
      marginRuleClassName="left-[30px]"
      backdrop={
        <span
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: PAPER_RULING, backgroundPosition: '0 76px' }}
        />
      }
      className={cn(
        'flex items-center justify-center py-14 pr-6 pl-12 [transform:rotate(-0.5deg)]',
        className
      )}
    >
      {content}
    </PaperSheet>
  );
}
