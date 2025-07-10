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
>(({ className, label, disabled, ...props }, ref) => (
  <label className="inline-flex cursor-pointer items-center gap-2 disabled:cursor-not-allowed">
    <SwitchPrimitive.Root
      ref={ref}
      disabled={disabled}
      className={cn(
        "group inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-inner shadow-black/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=unchecked]:bg-gray-200 data-[state=checked]:bg-gray-400",
        "hover:bg-gray-300 hover:data-[state=checked]:bg-gray-500",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform group-hover:shadow-md",
          "data-[state=checked]:translate-x-[1.25rem]"
        )}
      />
    </SwitchPrimitive.Root>
    {label && (
      <span
        className={cn(
          "select-none text-sm",
          disabled ? "text-gray-400" : "text-gray-900 dark:text-gray-100"
        )}
      >
        {label}
      </span>
    )}
  </label>
))
Switch.displayName = SwitchPrimitive.Root.displayName

export { Switch }

