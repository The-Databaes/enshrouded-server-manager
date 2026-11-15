import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { ArrowUpRightIcon, TerminalIcon } from "lucide-react";
import { useMemo } from "react";

import { useServerRuntime } from "@/hooks/use-server-runtime";
import type { LineKind } from "@/lib/server/runtime-types";

const PEEK_LINES = 14;

const KIND_CLASS: Record<LineKind, string | undefined> = {
  output: undefined,
  info: "text-ember",
  error: "text-destructive",
};

/** The last few console lines, fading out upwards. Opens the console. */
export const ConsolePeek = () => {
  const log = useServerRuntime((s) => s.log);
  const live = useServerRuntime(
    (s) => s.status?.phase === "starting" || s.status?.phase === "running",
  );
  const tail = useMemo(() => log.slice(-PEEK_LINES), [log]);

  return (
    <Link
      to="/console"
      className="group block overflow-hidden rounded-xl border border-border/75 bg-console shadow-[inset_0_1px_0_0_oklch(1_0_0/3%),0_10px_30px_-18px_oklch(0_0_0/60%)] transition-colors outline-none hover:border-shroud/40 focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      <div className="flex items-center gap-2 border-b px-4 py-3 text-sm">
        <TerminalIcon className="size-3.5 text-muted-foreground" />
        <span className="font-semibold">Console</span>
        {live ? (
          <span className="flex items-center gap-1.5 text-success">
            <span className="size-1.5 animate-pulse rounded-full bg-success" />
            live
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-1 text-muted-foreground transition-colors group-hover:text-foreground">
          Open
          <ArrowUpRightIcon className="size-3.5" />
        </span>
      </div>
      <div className="relative h-60 overflow-hidden px-4 font-mono text-xs leading-[1.6] text-foreground/80 mask-[linear-gradient(to_bottom,transparent,black_35%)]">
        <div className="absolute inset-x-4 bottom-3">
          {tail.length ? (
            tail.map((line) => (
              <p
                key={line.seq}
                className={cn("truncate", KIND_CLASS[line.kind])}
              >
                {line.text || " "}
              </p>
            ))
          ) : (
            <p className="text-muted-foreground">
              Quiet. Output appears here when the server starts.
            </p>
          )}
        </div>
      </div>
    </Link>
  );
};
