import { cn } from "cn";

/** Colours a player can get, from the palette (so both themes hold). */
const HUES = [
  "var(--ember)",
  "var(--shroud)",
  "var(--success)",
  "var(--warning)",
  "var(--chart-5)",
];

/** The same name always gets the same colour. */
const hueFor = (key: string) => {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return HUES[Math.abs(hash) % HUES.length];
};

/** A player's initial on a disc tinted by their name. */
export const PlayerAvatar = ({
  name,
  seed,
  size = "md",
  className,
}: {
  name: string | null;
  /** What to colour by when there's no name (e.g. the Steam ID). */
  seed?: string | null;
  size?: "sm" | "md";
  className?: string;
}) => {
  const color = hueFor(name ?? seed ?? "?");
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold",
        size === "md" ? "size-9 text-sm" : "size-7 text-xs",
        className,
      )}
      style={{
        color,
        background: `radial-gradient(circle at 30% 25%, color-mix(in oklch, ${color} 30%, transparent), color-mix(in oklch, ${color} 10%, transparent))`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${color} 35%, transparent)`,
      }}
    >
      {name?.trim().charAt(0).toUpperCase() ?? "?"}
    </span>
  );
};
