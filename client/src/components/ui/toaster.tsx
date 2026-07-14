import { Toaster as SonnerToaster } from 'sonner';

// App-wide toast region, styled to the receipt aesthetic: sharp 2px corners,
// ink hairline border, paper surface. Fire toasts with `toast(...)` from
// 'sonner' anywhere in the tree.
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            'rounded-[2px] border border-foreground bg-card text-card-foreground shadow-lg font-sans text-sm',
          title: 'font-semibold',
          description: 'text-muted-foreground',
          actionButton: 'rounded-[2px] bg-primary text-primary-foreground',
          cancelButton: 'rounded-[2px] bg-secondary text-secondary-foreground',
          success: '[&_[data-icon]]:text-success',
          error: '[&_[data-icon]]:text-destructive',
        },
      }}
    />
  );
}
