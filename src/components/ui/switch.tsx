"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  label?: React.ReactNode
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className, label, checked, disabled, ...props }, ref) => (
  <label className="inline-flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed">
    <SwitchPrimitive.Root
      ref={ref}
      checked={checked}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50",
        "data-[state=unchecked]:bg-gray-200 dark:data-[state=unchecked]:bg-gray-600",
        "data-[state=checked]:bg-primary",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform",
          "data-[state=unchecked]:translate-x-0",
          "data-[state=checked]:translate-x-5"
        )}
      />
    </SwitchPrimitive.Root>
    {label && (
      <span className={cn("select-none text-sm", disabled ? "text-gray-400" : "text-gray-900 dark:text-gray-100")}>
        {label}
      </span>
    )}
  </label>
))
Switch.displayName = SwitchPrimitive.Root.displayName

export { Switch }

