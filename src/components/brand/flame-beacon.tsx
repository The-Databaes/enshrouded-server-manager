import { cn } from "cn";
import { useId } from "react";

import type { BeaconState } from "@/lib/server/beacon";

const COLORS: Record<BeaconState, { outer: string; inner: string }> = {
  lit: { outer: "var(--ember)", inner: "var(--firelight)" },
  kindling: { outer: "var(--shroud)", inner: "var(--accent-foreground)" },
  faltering: { outer: "var(--warning)", inner: "var(--firelight)" },
  out: { outer: "var(--stone)", inner: "var(--muted-foreground)" },
};

/** Sparks drifting off a lit flame: [left %, delay s, drift px]. */
const SPARKS: [number, number, number][] = [
  [38, 0, -8],
  [55, 1.1, 7],
  [47, 2.2, -3],
  [62, 2.9, 10],
];

type FlameBeaconProps = {
  state: BeaconState;
  /** `sm` for the navigation rail, `lg` for a page's hero. */
  size?: "sm" | "lg";
  className?: string;
};

export const FlameBeacon = ({
  state,
  size = "lg",
  className,
}: FlameBeaconProps) => {
  const id = useId();
  const { outer, inner } = COLORS[state];
  const burning = state !== "out";
  const large = size === "lg";

  return (
    <div
      aria-hidden="true"
      data-state={state}
      className={cn(
        "relative isolate flex shrink-0 items-end justify-center",
        large ? "size-28" : "size-9",
        className,
      )}
    >
      {/* Halo */}
      <div
        className={cn(
          "absolute inset-0 -z-10 rounded-full blur-xl transition-opacity duration-700",
          burning ? "opacity-100" : "opacity-30",
          state === "lit" && "animate-breathe",
          state === "kindling" && "animate-pulse",
        )}
        style={{
          background: `radial-gradient(closest-side, color-mix(in oklch, ${outer} ${large ? 45 : 55}%, transparent), transparent)`,
        }}
      />

      <svg
        aria-hidden="true"
        viewBox="0 0 64 80"
        className={cn(
          "relative h-[86%] origin-bottom overflow-visible transition-[filter] duration-700",
          state === "lit" && "animate-flicker",
          state === "faltering" && "animate-pulse",
        )}
        style={{
          filter: burning
            ? `drop-shadow(0 0 ${large ? 10 : 4}px color-mix(in oklch, ${outer} 70%, transparent))`
            : undefined,
        }}
      >
        <defs>
          <linearGradient id={`${id}-outer`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={outer} />
            <stop offset="70%" stopColor={outer} stopOpacity="0.85" />
            <stop offset="100%" stopColor={inner} stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id={`${id}-inner`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={inner} />
            <stop offset="100%" stopColor={inner} stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {/* The bowl the flame burns in. */}
        <ellipse
          cx="32"
          cy="76"
          rx="17"
          ry="3"
          fill={outer}
          opacity={burning ? 0.35 : 0.2}
        />
        <path
          d="M32 4c3.5 13 19 22.5 19 43.5C51 63 42.5 75 32 75S13 63 13 47.5c0-11 6.5-17 10-26 1.6 6.4 3.6 10.4 7.6 12.6C29.4 23.6 29.8 13.4 32 4z"
          fill={`url(#${id}-outer)`}
          opacity={burning ? 1 : 0.55}
        />
        <path
          d="M32.6 33c3.4 8 9.8 12.6 9.8 23.2C42.4 66 37.6 72 32 72s-10.4-6-10.4-15.2c0-6.4 3.8-10 6.4-15.4 1 3.4 2.6 5.4 5 6.4-1.2-5.2-1.4-10.4-.4-14.8z"
          fill={`url(#${id}-inner)`}
          opacity={burning ? 0.95 : 0.35}
        />
      </svg>

      {state === "lit" && large
        ? SPARKS.map(([left, delay, drift]) => (
            <span
              key={left}
              className="absolute bottom-[45%] size-1 animate-ember-rise rounded-full bg-firelight shadow-[0_0_6px_var(--ember)]"
              style={
                {
                  left: `${left}%`,
                  animationDelay: `${delay}s`,
                  "--drift": `${drift}px`,
                } as React.CSSProperties
              }
            />
          ))
        : null}
    </div>
  );
};
