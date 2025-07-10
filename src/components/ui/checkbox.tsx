import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type CheckboxProps = React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>

const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <CheckboxPrimitive.Root
        ref={ref}
        className={cn(
          "h-5 w-5 rounded-sm border border-input bg-background shadow-sm ring-offset-background",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "data-[state=checked]:bg-primary data-[state=checked]:border-primary text-primary-foreground",
          "disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center",
          className
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="text-current">
          <CheckIcon className="h-3.5 w-3.5" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    )
  }
)

Checkbox.displayName = "Checkbox"

export { Checkbox }
