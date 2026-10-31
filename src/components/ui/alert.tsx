import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import * as React from "react";

/*
 * A notice, not a box: an accent edge on the left and a tint that fades out
 * to the right, so it reads as part of the page.
 */
const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 overflow-hidden rounded-r-lg border-l-2 py-3 pr-4 pl-4 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[1.25rem_1fr] has-[>svg]:gap-x-3 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-l-border bg-[linear-gradient(to_right,color-mix(in_oklch,var(--foreground)_5%,transparent),transparent_85%)] text-card-foreground *:[svg]:text-muted-foreground",
        /* The title and icon take the colour; the description stays muted. */
        destructive:
          "border-l-destructive bg-[linear-gradient(to_right,color-mix(in_oklch,var(--destructive)_14%,transparent),transparent_85%)] *:data-[slot=alert-title]:text-destructive *:[svg]:text-destructive",
        warning:
          "border-l-warning bg-[linear-gradient(to_right,color-mix(in_oklch,var(--warning)_13%,transparent),transparent_85%)] *:data-[slot=alert-title]:text-warning *:[svg]:text-warning",
        success:
          "border-l-success bg-[linear-gradient(to_right,color-mix(in_oklch,var(--success)_13%,transparent),transparent_85%)] *:data-[slot=alert-title]:text-success *:[svg]:text-success",
        info: "border-l-info bg-[linear-gradient(to_right,color-mix(in_oklch,var(--info)_13%,transparent),transparent_85%)] *:data-[slot=alert-title]:text-info *:[svg]:text-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-semibold tracking-[0.01em] group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-[0.84rem] text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className,
      )}
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-3 right-3", className)}
      {...props}
    />
  );
}

export { Alert, AlertAction, AlertDescription, AlertTitle };
