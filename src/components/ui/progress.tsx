"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Progress as ProgressPrimitive } from "radix-ui";
import * as React from "react";

/**
 * What the bar is measuring: ember (the default, work and resources), shroud
 * (players, things in transition) or a status colour for an outcome.
 */
const progressIndicatorVariants = cva(
  "size-full flex-1 rounded-full transition-all",
  {
    variants: {
      tone: {
        ember: "ember-fill",
        shroud: "shroud-fill",
        success: "bg-success",
        warning: "bg-warning",
        destructive: "bg-destructive",
      },
    },
    defaultVariants: {
      tone: "ember",
    },
  },
);

function Progress({
  className,
  value,
  tone = "ember",
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> &
  VariantProps<typeof progressIndicatorVariants>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      data-tone={tone}
      className={cn(
        "relative flex h-1.75 w-full items-center overflow-x-hidden rounded-full bg-secondary",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={progressIndicatorVariants({ tone })}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
