import { cn } from "cn";
import { ArrowDownIcon, TerminalIcon } from "lucide-react";
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatClock } from "@/lib/server/runtime-display";
import type { LineKind, LogLine } from "@/lib/server/runtime-types";

/** Lines per rendered chunk; only the newest chunk re-renders on output. */
const CHUNK_SIZE = 200;

const KIND_CLASS: Record<LineKind, string> = {
  output: "",
  // The manager's own notes ("The server is up…"): ember, with a marker.
  info: "text-ember before:bg-ember/70",
  error: "bg-destructive/[0.07] text-destructive before:bg-destructive/80",
};

type Chunk = { key: number; lines: LogLine[] };

/** `text` with every case-insensitive match of `query` highlighted. */
const Highlighted = ({ text, query }: { text: string; query: string }) => {
  if (!query) return text;
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  for (
    let at = lower.indexOf(query);
    at !== -1;
    at = lower.indexOf(query, at + query.length)
  ) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(
      <mark
        key={at}
        className="rounded-[3px] bg-ember/30 px-px text-foreground"
      >
        {text.slice(at, at + query.length)}
      </mark>,
    );
    from = at + query.length;
  }
  if (from < text.length) parts.push(text.slice(from));
  return parts;
};

const LogChunk = memo(
  ({
    lines,
    timestamps,
    wrap,
    query,
  }: {
    lines: LogLine[];
    timestamps: boolean;
    wrap: boolean;
    query: string;
  }) => (
    // Off-screen chunks skip layout and paint entirely.
    <div className="[contain-intrinsic-size:auto_3600px] [content-visibility:auto]">
      {lines.map((line) => (
        <div
          key={line.seq}
          className={cn(
            "relative flex gap-4 rounded-sm px-2 before:absolute before:inset-y-0.5 before:left-0 before:w-0.5 before:rounded-full hover:bg-foreground/[0.035]",
            KIND_CLASS[line.kind],
          )}
        >
          {timestamps ? (
            <span className="shrink-0 text-muted-foreground/55 select-none">
              {formatClock(line.at)}
            </span>
          ) : null}
          <span
            className={cn(
              "min-w-0 flex-1",
              wrap ? "whitespace-pre-wrap wrap-anywhere" : "whitespace-pre",
            )}
          >
            <Highlighted text={line.text} query={query} />
          </span>
        </div>
      ))}
    </div>
  ),
  // Lines never change once written, so a chunk is the same if it spans the
  // same range and is drawn the same way.
  (a, b) =>
    a.timestamps === b.timestamps &&
    a.wrap === b.wrap &&
    a.query === b.query &&
    a.lines.length === b.lines.length &&
    a.lines[0]?.seq === b.lines[0]?.seq &&
    a.lines.at(-1)?.seq === b.lines.at(-1)?.seq,
);

const toChunks = (lines: LogLine[]): Chunk[] => {
  const chunks: Chunk[] = [];
  for (const line of lines) {
    const key = Math.floor(line.seq / CHUNK_SIZE);
    const last = chunks.at(-1);
    if (last?.key === key) last.lines.push(line);
    else chunks.push({ key, lines: [line] });
  }
  return chunks;
};

type ServerConsoleProps = {
  lines: LogLine[];
  /** The server is running, so more output may come. */
  live: boolean;
  /** Controls for the toolbar (filters, toggles). */
  toolbar?: React.ReactNode;
  /** Shown when there are no lines. */
  empty?: React.ReactNode;
  timestamps?: boolean;
  wrap?: boolean;
  /** Text to highlight (lower case). */
  highlight?: string;
  className?: string;
};

/**
 * The server's console output. Follows new output like a terminal unless
 * the user scrolls up to read something.
 */
export const ServerConsole = ({
  lines,
  live,
  toolbar,
  empty = "Nothing yet. Output appears here when the server starts.",
  timestamps = true,
  wrap = true,
  highlight = "",
  className,
}: ServerConsoleProps) => {
  const viewport = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  const chunks = useMemo(() => toChunks(lines), [lines]);

  const lastSeq = lines.at(-1)?.seq;
  useLayoutEffect(() => {
    const el = viewport.current;
    if (follow && el && lastSeq !== undefined) el.scrollTop = el.scrollHeight;
  }, [lastSeq, follow]);

  const onScroll = () => {
    const el = viewport.current;
    if (!el) return;
    setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
  };

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border bg-console text-foreground/85 shadow-[inset_0_1px_0_0_oklch(1_0_0/3%),0_24px_48px_-28px_oklch(0_0_0/80%)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-foreground/[0.02] px-3 py-2 text-xs">
        <span className="flex items-center gap-2 pl-1 font-semibold text-foreground">
          <TerminalIcon className="size-3.5 text-muted-foreground" />
          enshrouded_server
        </span>
        {live ? (
          <span className="flex items-center gap-1.5 text-success">
            <span className="size-1.5 animate-pulse rounded-full bg-success" />
            live
          </span>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {toolbar}
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div
          ref={viewport}
          onScroll={onScroll}
          role="log"
          aria-live="off"
          aria-label="Server console output"
          className="absolute inset-0 overflow-auto px-2 py-3 font-mono text-[0.74rem] leading-[1.7]"
        >
          {chunks.length ? (
            chunks.map((chunk) => (
              <LogChunk
                key={chunk.key}
                lines={chunk.lines}
                timestamps={timestamps}
                wrap={wrap}
                query={highlight}
              />
            ))
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center font-sans text-sm text-muted-foreground">
              {empty}
            </div>
          )}
        </div>
        {!follow ? (
          <Button
            size="sm"
            variant="secondary"
            className="absolute right-4 bottom-4 animate-rise-in rounded-full shadow-shroud"
            onClick={() => setFollow(true)}
          >
            <ArrowDownIcon data-icon="inline-start" />
            Jump to latest
          </Button>
        ) : null}
      </div>
    </div>
  );
};
