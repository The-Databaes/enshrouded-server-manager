import { cn } from "cn";
import { useId } from "react";

type SparklineProps = {
  values: number[];
  /** Top of the scale; defaults to the largest value (with headroom). */
  max?: number;
  /** A CSS colour, e.g. `var(--ember)`. */
  color?: string;
  className?: string;
};

const W = 120;
const H = 32;

/**
 * A tiny trend line with a soft fill and a dot on the latest value. Plain SVG
 * so a few of them can redraw every few seconds without cost.
 */
export const Sparkline = ({
  values,
  max,
  color = "var(--ember)",
  className,
}: SparklineProps) => {
  const id = useId();
  if (values.length < 2) {
    return (
      <div
        aria-hidden="true"
        className={cn("h-8 w-full border-b border-dashed", className)}
      />
    );
  }
  const top = Math.max(max ?? Math.max(...values) * 1.25, 1e-9);
  const step = W / (values.length - 1);
  const points = values.map(
    (v, i) => [i * step, H - 2 - (Math.min(v, top) / top) * (H - 6)] as const,
  );
  const line = points
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("h-8 w-full overflow-visible", className)}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${W} ${H} L0 ${H} Z`} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={lastX}
        cy={lastY}
        r="2.5"
        fill={color}
        vectorEffect="non-scaling-stroke"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  );
};
