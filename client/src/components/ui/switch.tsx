import * as React from "react"
import { cn } from "@/lib/utils"

export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

// Receipt-style toggle (design 1D): 44×24 track with a 1.5px border and the
// system's sharp 2px corners — on = orange track/white knob, off = sand
// track/ink knob.
const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, onCheckedChange, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-[2px] border-[1.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-brand-orange bg-brand-orange" : "border-border bg-secondary",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-[1px] transition-transform",
          checked ? "translate-x-[23px] bg-[#FAFAF8]" : "translate-x-[2px] bg-primary"
        )}
      />
    </button>
  )
)
Switch.displayName = "Switch"

export { Switch }
