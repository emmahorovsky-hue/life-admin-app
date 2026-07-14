import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  /** Right-aligned footer actions (Cancel + primary), under a dashed rule. */
  footer: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
}

/**
 * Shared chrome for the Settings modals (design 1D): 448px card, ink hairline
 * border, 2px corners, orange-period title + icon-only close, dashed footer rule.
 */
export function SettingsDialog({ open, onOpenChange, title, children, footer, onSubmit }: SettingsDialogProps) {
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
      <div className="px-6 pb-5">{children}</div>
      <div className="border-perf-t flex justify-end gap-2 px-6 py-4">{footer}</div>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[448px] w-[calc(100%-2rem)] rounded-[2px] border border-foreground bg-card p-0 shadow-2xl">
        {onSubmit ? <form onSubmit={onSubmit}>{body}</form> : body}
      </DialogContent>
    </Dialog>
  );
}
