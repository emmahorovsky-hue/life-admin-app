import * as React from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input, type InputProps } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type PasswordInputProps = Omit<InputProps, "type">

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, disabled, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false)

    return (
      <div className="relative">
        <Input
          type={visible ? "text" : "password"}
          className={cn("pr-10 [&::-ms-reveal]:hidden", className)}
          disabled={disabled}
          ref={ref}
          {...props}
        />
        <button
          type="button"
          // preventDefault keeps focus (and the caret) in the input when toggling
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    )
  }
)
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
