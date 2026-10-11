import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * A status tint over the popover surface, like the matching Alert variant.
 * Mixed in oklab: oklch would swing the hue around the wheel between violet
 * and orange/green and land on pink.
 */
const richColors = (name: string, token: string) => ({
  [`--${name}-bg`]: `color-mix(in oklab, var(${token}) 12%, var(--popover))`,
  [`--${name}-border`]: `color-mix(in oklab, var(${token}) 45%, var(--popover))`,
  [`--${name}-text`]: `var(${token})`,
});

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin text-ember" />,
      }}
      // Sonner ships its own palettes for both themes; point every one of its
      // colour variables at ours. Rich colours follow the status tokens.
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-bg-hover": "var(--accent)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--normal-border-hover": "var(--border)",
          ...richColors("success", "--success"),
          ...richColors("info", "--info"),
          ...richColors("warning", "--warning"),
          ...richColors("error", "--destructive"),
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      // Sonner's own stylesheet is unlayered, so these need `!` to win.
      toastOptions={{
        classNames: {
          toast: "cn-toast font-sans! shadow-stone! gap-2.5!",
          title: "text-sm! font-semibold!",
          description: "text-[0.8125rem]! text-muted-foreground!",
          actionButton:
            "bg-primary! font-semibold! text-primary-foreground! hover:bg-[color-mix(in_oklch,var(--primary),white_12%)]!",
          cancelButton: "bg-secondary! text-secondary-foreground!",
          closeButton:
            "border-border! bg-popover! text-muted-foreground! hover:bg-accent! hover:text-accent-foreground!",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
