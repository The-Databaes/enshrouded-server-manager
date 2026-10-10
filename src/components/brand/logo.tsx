import { cn } from "cn";
import { useId } from "react";

type LogoMarkProps = React.ComponentProps<"svg"> & {
  /** Draw the dark rounded tile behind the flame (matches the app icon). */
  tile?: boolean;
};

/**
 * The Flame on its altar ring. Same geometry as `assets/brand/icon.svg`.
 * Colours are fixed (not theme tokens) so the mark looks identical to the
 * OS icon in both themes.
 */
export const LogoMark = ({
  tile = false,
  className,
  ...props
}: LogoMarkProps) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg
      viewBox="0 0 1024 1024"
      role="img"
      aria-label="Enshrouded Server Manager"
      className={cn("shrink-0", className)}
      {...props}
    >
      <defs>
        <linearGradient id={`${uid}-tile`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2338" />
          <stop offset="1" stopColor="#0b101c" />
        </linearGradient>
        <linearGradient id={`${uid}-flame-outer`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="0.45" stopColor="#f6a623" />
          <stop offset="1" stopColor="#d9442b" />
        </linearGradient>
        <linearGradient id={`${uid}-flame-inner`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff8dc" />
          <stop offset="1" stopColor="#ffcf5c" />
        </linearGradient>
        <linearGradient id={`${uid}-ring`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b88420" />
          <stop offset="0.5" stopColor="#ffd977" />
          <stop offset="1" stopColor="#b88420" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffb347" stopOpacity="0.75" />
          <stop offset="0.6" stopColor="#f6a623" stopOpacity="0.18" />
          <stop offset="1" stopColor="#f6a623" stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}-mist`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="55" />
        </filter>
        <clipPath id={`${uid}-clip`}>
          <rect width="1024" height="1024" rx="224" ry="224" />
        </clipPath>
      </defs>

      {tile ? (
        <>
          <rect
            width="1024"
            height="1024"
            rx="224"
            ry="224"
            fill={`url(#${uid}-tile)`}
          />
          <g clipPath={`url(#${uid}-clip)`}>
            <ellipse
              cx="280"
              cy="900"
              rx="380"
              ry="150"
              fill="#2fc7b8"
              opacity="0.55"
              filter={`url(#${uid}-mist)`}
            />
            <ellipse
              cx="780"
              cy="940"
              rx="400"
              ry="150"
              fill="#1fb3c4"
              opacity="0.45"
              filter={`url(#${uid}-mist)`}
            />
            <ellipse
              cx="520"
              cy="1010"
              rx="560"
              ry="150"
              fill="#6d5bd0"
              opacity="0.35"
              filter={`url(#${uid}-mist)`}
            />
            <circle cx="512" cy="560" r="330" fill={`url(#${uid}-glow)`} />
          </g>
        </>
      ) : null}

      <ellipse
        cx="512"
        cy="796"
        rx="200"
        ry="42"
        fill="none"
        stroke={`url(#${uid}-ring)`}
        strokeWidth="14"
        opacity="0.9"
      />
      <path
        d="M512 150 C548 262 704 352 704 548 C704 684 612 776 512 800 C412 776 320 684 320 548 C320 456 372 410 398 318 C410 390 450 428 474 402 C446 330 466 240 512 150 Z"
        fill={`url(#${uid}-flame-outer)`}
      />
      <path
        d="M512 400 C530 470 612 512 612 608 C612 678 566 724 512 736 C458 724 412 678 412 608 C412 556 440 536 452 486 C458 528 484 544 496 524 C480 480 490 448 512 400 Z"
        fill={`url(#${uid}-flame-inner)`}
      />
    </svg>
  );
};

type LogoProps = React.ComponentProps<"div"> & {
  /** Hide the wordmark and show only the mark (e.g. collapsed sidebar). */
  compact?: boolean;
};

/** Mark + wordmark lockup used in the sidebar header and about screens. */
export const Logo = ({ compact = false, className, ...props }: LogoProps) => {
  return (
    <div className={cn("flex items-center gap-2.5", className)} {...props}>
      <LogoMark tile className="size-8 rounded-md shadow-glow-flame" />
      {compact ? null : (
        <div className="flex min-w-0 flex-col leading-none">
          <span className="truncate font-display text-[0.95rem] font-bold tracking-[0.12em] text-flame-gradient">
            ENSHROUDED
          </span>
          <span className="truncate text-[0.62rem] font-medium tracking-[0.24em] text-shroud uppercase">
            Server Manager
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * Hero banner rendered with theme tokens (unlike the static PNG in
 * `public/banner.png`, this one follows light/dark mode).
 */
export const BrandBanner = ({
  className,
  ...props
}: React.ComponentProps<"div">) => {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-xl border bg-shroud-mist px-6 py-8 sm:px-10",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <LogoMark className="size-28 animate-flicker drop-shadow-[0_0_28px_oklch(0.8_0.16_70/0.45)]" />
        <div className="space-y-2">
          <h1 className="font-display text-4xl font-bold tracking-[0.1em] text-flame-gradient sm:text-5xl">
            ENSHROUDED
          </h1>
          <div className="rule-gold w-56" />
          <p className="font-display text-sm font-medium tracking-[0.35em] text-shroud uppercase">
            Server Manager
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            Keep the Flame burning across Embervale.
          </p>
        </div>
      </div>
    </div>
  );
};
