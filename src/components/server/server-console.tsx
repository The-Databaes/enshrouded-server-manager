import { cn } from "cn";
import { ArrowDownIcon, CopyIcon, TerminalIcon } from "lucide-react";
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatClock } from "@/lib/server/runtime-display";
import type { LineKind, LogLine } from "@/lib/server/runtime-types";

/** Lines per rendered chunk; only the newest chunk re-renders on output. */
const CHUNK_SIZE = 200;

const KIND_CLASS: Record<LineKind, string | undefined> = {
  output: undefined,
  info: "text-ember",
  error: "text-destructive",
};

type Chunk = { key: number; lines: LogLine[] };

const LogChunk = memo(
  ({ lines, timestamps }: { lines: LogLine[]; timestamps: boolean }) => (
    // Off-screen chunks skip layout and paint entirely.
    <div className="[contain-intrinsic-size:auto_3600px] [content-visibility:auto]">
      {lines.map((line) => (
        <div
          key={line.seq}
          className={cn(
            "whitespace-pre-wrap wrap-anywhere",
            KIND_CLASS[line.kind],
          )}
        >
          {timestamps ? (
            <span className="mr-3 text-muted-foreground/70 select-none">
              {formatClock(line.at)}
            </span>
          ) : null}
          {line.text}
        </div>
      ))}
    </div>
  ),
  // Lines never change once written, so a chunk is the same if it spans the
  // same range.
  (a, b) =>
    a.timestamps === b.timestamps &&
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
  title?: string;
  /** Extra controls for the toolbar (e.g. a filter). */
  toolbar?: React.ReactNode;
  emptyText?: string;
  timestamps?: boolean;
  /** Height of the scrolling area. */
  viewportClassName?: string;
  className?: string;
};

/**
 * The server's console output. Follows new output like a terminal unless
 * the user scrolls up to read something.
 */
export const ServerConsole = ({
  lines,
  live,
  title = "Server console",
  toolbar,
  emptyText = "Nothing yet. Output appears here when the server starts.",
  timestamps = true,
  viewportClassName = "h-96",
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        lines.map((l) => `${formatClock(l.at)}  ${l.text}`).join("\n"),
      );
      toast.success("Console output copied");
    } catch {
      toast.error("Couldn't copy to the clipboard");
    }
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-console text-foreground/85",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-1.5 text-xs">
        <TerminalIcon className="size-3.5 text-muted-foreground" />
        <span className="font-semibold text-foreground">{title}</span>
        {live ? (
          <span className="flex items-center gap-1.5 text-success">
            <span className="size-1.5 animate-pulse rounded-full bg-success" />
            live
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {toolbar}
          <span className="text-muted-foreground tabular-nums">
            {lines.length} {lines.length === 1 ? "line" : "lines"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground"
            aria-label="Copy console output"
            onClick={() => void copy()}
            disabled={!lines.length}
          >
            <CopyIcon className="size-3" />
          </Button>
        </div>
      </div>
      <div className="relative">
        <div
          ref={viewport}
          onScroll={onScroll}
          role="log"
          aria-live="off"
          aria-label={title}
          className={cn(
            "overflow-y-auto px-4 py-3 font-mono text-[0.72rem] leading-relaxed",
            viewportClassName,
          )}
        >
          {chunks.length ? (
            chunks.map((chunk) => (
              <LogChunk
                key={chunk.key}
                lines={chunk.lines}
                timestamps={timestamps}
              />
            ))
          ) : (
            <p className="text-muted-foreground">{emptyText}</p>
          )}
        </div>
        {!follow ? (
          <Button
            size="sm"
            variant="secondary"
            className="absolute right-3 bottom-3 shadow-shroud"
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
