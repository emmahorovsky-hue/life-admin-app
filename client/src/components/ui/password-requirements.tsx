import { passwordRuleResults } from "@life-admin/shared"
import { IconCheck } from "@/components/icons"
import { cn } from "@/lib/utils"

interface PasswordRequirementsProps {
  /** Referenced by the password input's `aria-describedby`. */
  id: string
  password: string
  /**
   * Set after a failed submit: unmet rules turn red so the reason is on the
   * field, not in a banner above the button.
   */
  showErrors?: boolean
}

/**
 * Live checklist of the shared password rules, rendered under a new-password
 * field. Each row ticks as it is satisfied. Colour only, no motion: this
 * changes on every keystroke, and animating it would be noise.
 */
export function PasswordRequirements({ id, password, showErrors = false }: PasswordRequirementsProps) {
  return (
    <ul id={id} className="space-y-1 text-xs" aria-live="polite">
      {passwordRuleResults(password).map(({ id: ruleId, label, met }) => (
        <li
          key={ruleId}
          className={cn(
            "flex items-center gap-1.5 transition-colors duration-150",
            met ? "text-foreground" : showErrors ? "text-destructive" : "text-muted-foreground"
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
              met ? "border-success bg-success text-white" : "border-current"
            )}
          >
            {met && <IconCheck className="h-2.5 w-2.5" strokeWidth={3} />}
          </span>
          {label}
          <span className="sr-only">{met ? "(done)" : "(not yet)"}</span>
        </li>
      ))}
    </ul>
  )
}
