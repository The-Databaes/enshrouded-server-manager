import { cn } from "cn";

import detailedUrl from "../../../assets/brand/icon.svg?url";
import microUrl from "../../../assets/brand/icon-micro.svg?url";
import simpleUrl from "../../../assets/brand/icon-simple.svg?url";

const VARIANTS = {
  detailed: detailedUrl,
  simple: simpleUrl,
  micro: microUrl,
};

type LogoMarkProps = Omit<React.ComponentProps<"img">, "src"> & {
  /**
   * Which drawing to show, by rendered size: `micro` up to 32px, `simple`
   * for 40–48px, `detailed` from 64px. Matches the OS icon at each size.
   * `micro` is the Flame alone; the larger two draw the full beacon tower.
   */
  variant?: keyof typeof VARIANTS;
};

/**
 * The app icon: the beacon spire crowned by the Flame, rising out of the
 * Shroud. Renders the brand SVGs from `assets/brand` directly, so it always
 * matches the OS icon in both themes.
 */
export const LogoMark = ({
  variant = "detailed",
  className,
  alt = "Enshrouded Server Manager",
  ...props
}: LogoMarkProps) => (
  <img
    src={VARIANTS[variant]}
    alt={alt}
    draggable={false}
    className={cn("shrink-0 select-none", className)}
    {...props}
  />
);

type LogoProps = React.ComponentProps<"div"> & {
  /** Hide the wordmark and show only the mark (e.g. collapsed sidebar). */
  compact?: boolean;
};

/** Mark + wordmark lockup used in the sidebar header and about screens. */
export const Logo = ({ compact = false, className, ...props }: LogoProps) => {
  return (
    <div className={cn("flex items-center gap-2.5", className)} {...props}>
      <LogoMark
        alt={compact ? undefined : ""}
        className={cn(
          "rounded-[22%] shadow-ember",
          compact ? "size-8" : "size-9",
        )}
      />
      {compact ? null : (
        <div className="flex min-w-0 flex-col leading-none">
          <span className="truncate font-display text-[0.9rem] font-bold tracking-[0.1em] text-foreground">
            ENSHROUDED
          </span>
          <span className="mt-0.5 truncate text-[0.66rem] font-medium tracking-[0.08em] text-muted-foreground">
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
        "shroud-mist relative isolate overflow-hidden rounded-xl border px-6 py-8 shadow-stone sm:px-10",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <LogoMark className="size-28 drop-shadow-[0_0_28px_color-mix(in_oklch,var(--ember)_35%,transparent)]" />
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-[0.12em] sm:text-5xl">
            ENSHROUDED
          </h1>
          <div className="rule-ember w-56" />
          <p className="text-xs font-semibold tracking-[0.22em] text-shroud uppercase">
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
