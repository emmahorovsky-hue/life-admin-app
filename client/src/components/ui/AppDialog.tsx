import { useCallback, useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  /** Right-aligned footer actions, rendered under a dashed rule. Omit for a footerless card. */
  footer?: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  /** Extra classes on the card (e.g. a wider `max-w-*`). Defaults to the 448px settings width. */
  className?: string;
  /** Override the default body padding when a dialog needs to bleed content to the edges. */
  bodyClassName?: string;
  /** Extra classes on the footer row, e.g. to lay actions out along the full width. */
  footerClassName?: string;
  /** Rendered between the title and the body, outside the scrollable region (e.g. a step strip). */
  subheader?: React.ReactNode;
  /** Small mono label above the title, e.g. a step counter. */
  eyebrow?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The app's single modal chrome (design 1D, first shipped in Settings): ink
 * hairline border, 2px corners, `bg-card`, `shadow-2xl`, an extra-bold title
 * with an orange period + icon-only close, and a dashed footer rule. Every
 * simple form/confirm dialog should render through this so the modals can't
 * drift apart. The two-pane subscription receipt modal borrows the same tokens
 * directly (it has its own layout) rather than going through here.
 *
 * The underlying `Dialog` is a hand-rolled overlay with no accessibility
 * behaviour of its own, so Escape-to-close, the focus trap and the dialog
 * semantics live here (LIF-220) — that puts them in one place for every modal
 * that goes through this chrome, rather than once per call site.
 */
export function AppDialog({
  open,
  onOpenChange,
  title,
  children,
  footer,
  onSubmit,
  className,
  bodyClassName,
  footerClassName,
  subheader,
  eyebrow,
}: AppDialogProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Where focus came from, so closing can hand it back rather than dropping the
  // user at the top of the document.
  const restoreFocusTo = useRef<Element | null>(null);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    if (!open) return;

    restoreFocusTo.current = document.activeElement;
    // Focus the first control inside the card. Falls back to the card itself
    // (tabIndex -1) when a dialog opens with nothing focusable in it yet.
    const first = cardRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? cardRef.current)?.focus();

    return () => {
      if (restoreFocusTo.current instanceof HTMLElement) restoreFocusTo.current.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        return;
      }

      if (e.key !== 'Tab' || !cardRef.current) return;

      // Cycle focus within the card. Re-queried on each Tab because the
      // focusable set changes as steps/among disabled buttons change.
      const focusable = Array.from(cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !cardRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, close]);

  const body = (
    <>
      <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-5 pb-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
              {eyebrow}
            </p>
          )}
          <DialogTitle id={titleId} className="text-lg font-extrabold">
            {title}
            <span className="text-brand-orange">.</span>
          </DialogTitle>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 -mr-1 -mt-1 shrink-0"
          aria-label="Close"
          onClick={close}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {subheader}
      <div className={cn('px-6 pb-5', bodyClassName)}>{children}</div>
      {footer && (
        <div className={cn('border-perf-t flex shrink-0 justify-end gap-2 px-6 py-4', footerClassName)}>
          {footer}
        </div>
      )}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'max-w-[448px] w-[calc(100%-2rem)] rounded-[2px] border border-foreground bg-card p-0 shadow-2xl outline-none',
          className
        )}
      >
        {onSubmit ? <form onSubmit={onSubmit}>{body}</form> : body}
      </DialogContent>
    </Dialog>
  );
}
