import { AppDialog } from '@/components/ui/AppDialog';

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
 * The Settings modals' dialog. Thin wrapper over the shared {@link AppDialog}
 * chrome (design 1D) so the Settings call sites keep their own name and a
 * required footer, while the border/shadow/header style lives in one place.
 */
export function SettingsDialog(props: SettingsDialogProps) {
  return <AppDialog {...props} />;
}
