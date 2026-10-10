import { cn } from "cn";
import { ArrowDownIcon, CopyIcon, TerminalIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** Colour a line by what SteamCMD is telling us. */
const lineClass = (line: string) => {
  if (line.startsWith("> ")) return "text-flame";
  if (/^(error!|failed|steamcmd exited with code [1-9])/i.test(line))
    return "text-ember";
  if (line.startsWith("Success!")) return "text-success";
  if (/progress: |^\[\s*\d+%\]/.test(line)) return "text-shroud";
  return undefined;
};

type SteamCmdConsoleProps = {
  lines: string[];
  /** Line SteamCMD is still writing, shown last with a cursor. */
  partial?: string | null;
  running: boolean;
  className?: string;
};

/**
 * Live view of SteamCMD's console output. Follows new output like a terminal
 * unless the user scrolls up to read something.
 */
export const SteamCmdConsole = ({
  lines,
  partial = null,
  running,
  className,
}: SteamCmdConsoleProps) => {
  const viewport = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);

  const lineCount = lines.length;
  useLayoutEffect(() => {
    const el = viewport.current;
    if (follow && el && (lineCount || partial)) el.scrollTop = el.scrollHeight;
  }, [lineCount, partial, follow]);

  const onScroll = () => {
    const el = viewport.current;
    if (!el) return;
    setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Console output copied");
    } catch {
      toast.error("Couldn't copy to the clipboard");
    }
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-300",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs">
        <TerminalIcon className="size-3.5 text-zinc-500" />
        <span className="font-medium text-zinc-300">SteamCMD console</span>
        {running ? (
          <span className="flex items-center gap-1.5 text-success">
            <span className="size-1.5 animate-pulse rounded-full bg-success" />
            live
          </span>
        ) : null}
        <span className="ml-auto text-zinc-500 tabular-nums">
          {lineCount} {lineCount === 1 ? "line" : "lines"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          aria-label="Copy console output"
          onClick={() => void copy()}
          disabled={!lineCount}
        >
          <CopyIcon className="size-3" />
        </Button>
      </div>
      <div className="relative">
        <div
          ref={viewport}
          onScroll={onScroll}
          role="log"
          aria-live="off"
          aria-label="SteamCMD console output"
          className="h-72 overflow-y-auto px-3 py-2 font-mono text-[0.7rem] leading-relaxed"
        >
          {lineCount || partial ? (
            lines.map((line, i) => (
              <div
                // Lines are append-only, so the index is a stable key.
                // biome-ignore lint/suspicious/noArrayIndexKey: append-only log
                key={i}
                className={cn("break-all whitespace-pre-wrap", lineClass(line))}
              >
                {line}
              </div>
            ))
          ) : (
            <p className="text-zinc-500">Waiting for SteamCMD…</p>
          )}
          {partial || running ? (
            <div className="break-all whitespace-pre-wrap">
              {partial}
              {running ? (
                <span
                  aria-hidden="true"
                  className="ml-px inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-zinc-400"
                />
              ) : null}
            </div>
          ) : null}
        </div>
        {!follow ? (
          <Button
            size="sm"
            variant="secondary"
            className="absolute right-3 bottom-3 h-7 shadow-md"
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
