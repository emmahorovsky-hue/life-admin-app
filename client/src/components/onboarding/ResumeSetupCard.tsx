import { Button } from '@/components/ui/button';
import { PaperSheet } from '@/components/PaperSheet';
import type { OnboardingStep } from '@/lib/onboarding';

interface ResumeSetupCardProps {
  /** Step the skipped wizard will reopen at. */
  step: OnboardingStep;
  onResume: () => void;
}

/**
 * Stands in for the first-run wizard once it has been skipped (LIF-220). It is
 * deliberately not dismissible: the dashboard underneath is entirely usable, so
 * the strip costs the user nothing, and it disappears on its own the moment a
 * first subscription exists.
 */
export function ResumeSetupCard({ step, onResume }: ResumeSetupCardProps) {
  return (
    <PaperSheet className="py-4 pl-12 pr-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
            Step {step} of 3 · Not started
          </p>
          <h3 className="mt-1 text-base font-bold">Finish setting up your file</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Takes about a minute. Pick your services, check the amounts, done.
          </p>
        </div>
        <Button type="button" onClick={onResume} className="shrink-0 max-md:w-full">
          Resume setup
        </Button>
      </div>
    </PaperSheet>
  );
}
