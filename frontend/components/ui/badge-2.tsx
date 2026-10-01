import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 border font-medium whitespace-nowrap transition-colors [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        primary: "",
        secondary: "",
        success: "",
        warning: "",
        info: "",
        destructive: "",
      },
      appearance: {
        solid: "border-transparent",
        light: "border-transparent",
        outline: "bg-transparent",
      },
      size: {
        sm: "h-5 px-2 text-[10px]",
        default: "h-6 px-2.5 text-xs",
        lg: "h-7 px-3 text-sm",
      },
      shape: {
        default: "rounded-md",
        circle: "rounded-full",
      },
    },
    compoundVariants: [
      // solid
      { variant: "primary", appearance: "solid", className: "bg-primary text-primary-foreground" },
      { variant: "secondary", appearance: "solid", className: "bg-secondary text-secondary-foreground" },
      { variant: "success", appearance: "solid", className: "bg-emerald-600 text-white" },
      { variant: "warning", appearance: "solid", className: "bg-amber-500 text-white" },
      { variant: "info", appearance: "solid", className: "bg-blue-600 text-white" },
      { variant: "destructive", appearance: "solid", className: "bg-destructive text-white" },
      // light
      { variant: "primary", appearance: "light", className: "bg-primary/10 text-primary" },
      { variant: "secondary", appearance: "light", className: "bg-muted text-muted-foreground" },
      { variant: "success", appearance: "light", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
      { variant: "warning", appearance: "light", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
      { variant: "info", appearance: "light", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
      { variant: "destructive", appearance: "light", className: "bg-destructive/10 text-destructive" },
      // outline
      { variant: "primary", appearance: "outline", className: "border-primary/30 text-primary" },
      { variant: "secondary", appearance: "outline", className: "border-border text-muted-foreground" },
      { variant: "success", appearance: "outline", className: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" },
      { variant: "warning", appearance: "outline", className: "border-amber-500/40 text-amber-600 dark:text-amber-400" },
      { variant: "info", appearance: "outline", className: "border-blue-500/40 text-blue-600 dark:text-blue-400" },
      { variant: "destructive", appearance: "outline", className: "border-destructive/40 text-destructive" },
    ],
    defaultVariants: {
      variant: "primary",
      appearance: "solid",
      size: "default",
      shape: "default",
    },
  }
)

function Badge({
  className,
  variant,
  appearance,
  size,
  shape,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, appearance, size, shape }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
