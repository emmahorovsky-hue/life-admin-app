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
}

/**
 * The app's single modal chrome (design 1D, first shipped in Settings): ink
 * hairline border, 2px corners, `bg-card`, `shadow-2xl`, an extra-bold title
 * with an orange period + icon-only close, and a dashed footer rule. Every
 * simple form/confirm dialog should render through this so the modals can't
 * drift apart. The two-pane subscription receipt modal borrows the same tokens
 * directly (it has its own layout) rather than going through here.
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
}: AppDialogProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
        <DialogTitle className="text-lg font-extrabold">
          {title}
          <span className="text-brand-orange">.</span>
        </DialogTitle>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 -mr-1 -mt-1 shrink-0"
          aria-label="Close"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className={cn('px-6 pb-5', bodyClassName)}>{children}</div>
      {footer && <div className="border-perf-t flex justify-end gap-2 px-6 py-4">{footer}</div>}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-w-[448px] w-[calc(100%-2rem)] rounded-[2px] border border-foreground bg-card p-0 shadow-2xl',
          className
        )}
      >
        {onSubmit ? <form onSubmit={onSubmit}>{body}</form> : body}
      </DialogContent>
    </Dialog>
  );
}
