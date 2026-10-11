import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import * as React from "react";

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg border px-4 py-3.5 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[1.25rem_1fr] has-[>svg]:gap-x-3 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card/70 text-card-foreground",
        /* The title and icon take the colour; the description stays muted. */
        destructive:
          "border-destructive/45 bg-destructive/10 *:data-[slot=alert-title]:text-destructive *:[svg]:text-destructive",
        warning:
          "border-warning/45 bg-warning/10 *:data-[slot=alert-title]:text-warning *:[svg]:text-warning",
        success:
          "border-success/45 bg-success/10 *:data-[slot=alert-title]:text-success *:[svg]:text-success",
        info: "border-info/45 bg-info/10 *:data-[slot=alert-title]:text-info *:[svg]:text-info",
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
        "font-heading font-semibold tracking-[0.03em] group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
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
