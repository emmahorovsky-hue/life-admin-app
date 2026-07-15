import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DeleteAccountDialog } from '@/components/settings/DeleteAccountDialog';

/** Data & privacy panel (LIF-188): the destructive delete-account flow. */
export default function PrivacyPanel() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="rounded-[2px] border-[1.5px] border-brand-orange bg-white p-6 dark:bg-card">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-brand-orange">Delete account</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Permanently remove your account and all data.
            </p>
          </div>
          <Button variant="destructive" className="shrink-0" onClick={() => setOpen(true)}>
            Delete
          </Button>
        </div>
      </section>

      {open && <DeleteAccountDialog open onOpenChange={setOpen} />}
    </>
  );
}
