import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";
import * as React from "react";

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.25 py-0.5 text-[0.72rem] font-semibold tracking-[0.04em] whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive text-destructive-foreground focus-visible:ring-destructive/40 [a]:hover:bg-destructive/80",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        /* Status: healthy, in transition, needs attention, failed, idle. */
        success: "border-success/35 bg-success/14 text-success",
        info: "border-info/38 bg-info/14 text-info",
        warning: "border-warning/38 bg-warning/14 text-warning",
        error: "border-destructive/40 bg-destructive/14 text-destructive",
        neutral: "border-border bg-stone/16 text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

/**
 * The status light inside a status badge. `pulse` breathes a shroud ring
 * around it for states that are still changing (starting, updating).
 */
function BadgeDot({
  pulse = false,
  className,
  ...props
}: React.ComponentProps<"span"> & { pulse?: boolean }) {
  return (
    <span
      data-slot="badge-dot"
      aria-hidden="true"
      className={cn(
        "size-1.75 shrink-0 rounded-full bg-current",
        pulse && "animate-pulse-shroud",
        className,
      )}
      {...props}
    />
  );
}

export { Badge, BadgeDot, badgeVariants };
