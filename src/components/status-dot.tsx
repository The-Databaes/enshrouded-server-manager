import { cn } from "cn";

import type { StatusTone } from "@/lib/server/runtime-display";

const TONES: Record<StatusTone | "error", string> = {
  success: "bg-success text-success",
  info: "bg-info text-info",
  warning: "bg-warning text-warning",
  error: "bg-destructive text-destructive",
  neutral: "bg-stone text-stone",
};

/**
 * A status light. Lit tones glow; `pulse` adds a breathing ring for states
 * that are still changing.
 */
export const StatusDot = ({
  tone,
  pulse = false,
  className,
}: {
  tone: StatusTone | "error";
  pulse?: boolean;
  className?: string;
}) => (
  <span
    aria-hidden="true"
    className={cn(
      "relative inline-flex size-2 shrink-0 rounded-full",
      TONES[tone],
      tone !== "neutral" && "shadow-[0_0_8px_currentColor]",
      className,
    )}
  >
    {pulse ? (
      <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60" />
    ) : null}
  </span>
);
