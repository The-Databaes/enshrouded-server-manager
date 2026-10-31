import { cn } from "cn";
import { formatDistanceToNowStrict } from "date-fns";

import { FlameBeacon } from "@/components/brand/flame-beacon";
import { ServerControls } from "@/components/server/server-controls";
import { StatusDot } from "@/components/status-dot";
import { useNow } from "@/hooks/use-now";
import { useRuntimeStatus } from "@/hooks/use-server-runtime";
import { type BeaconState, beaconState } from "@/lib/server/beacon";
import {
  formatDuration,
  phaseView,
  uptimeMs,
} from "@/lib/server/runtime-display";
import type { ServerStatus } from "@/lib/server/types";

const GLOW: Record<BeaconState, string> = {
  lit: "var(--ember)",
  kindling: "var(--shroud)",
  faltering: "var(--warning)",
  out: "color-mix(in oklch, var(--shroud) 45%, transparent)",
};

const Sep = () => (
  <span aria-hidden="true" className="text-muted-foreground/50">
    ·
  </span>
);

/** The top of the dashboard: the Flame, the server's name and what it's doing. */
export const ServerHero = ({
  files,
  blockedReason,
  children,
}: {
  files: ServerStatus;
  blockedReason: string | null;
  /** Notices shown under the hero (crashes, a stuck start, …). */
  children?: React.ReactNode;
}) => {
  const status = useRuntimeStatus();
  const changing = status?.phase === "starting" || status?.phase === "stopping";
  const now = useNow(changing ? 1000 : 30_000);
  const state = beaconState(status);
  const view = phaseView(status);
  const name = files.settings?.name ?? "Enshrouded server";
  const query = status?.phase === "running" ? status.query : null;

  const details: React.ReactNode[] = [];
  if (status?.phase === "running") {
    details.push(
      <span key="up">Up {formatDuration(uptimeMs(status, now))}</span>,
    );
    if (query) {
      details.push(
        <span key="players">
          {query.players} of {query.maxPlayers} players
        </span>,
      );
      if (query.version)
        details.push(<span key="version">Version {query.version}</span>);
    }
  } else if (status?.phase === "starting") {
    details.push(
      <span key="starting">
        Lighting the Flame for {formatDuration(uptimeMs(status, now))}
      </span>,
    );
  } else if (status?.phase === "stopping") {
    details.push(<span key="saving">Saving the world before it stops</span>);
  } else if (status?.lastExit) {
    details.push(
      <span key="stopped">
        Stopped{" "}
        {now - status.lastExit.at < 60_000
          ? "just now"
          : formatDistanceToNowStrict(status.lastExit.at, { addSuffix: true })}
      </span>,
    );
  } else if (status) {
    details.push(<span key="never">Not started yet</span>);
  }

  return (
    <section
      aria-label="Server status"
      className="hero-glow relative isolate space-y-6"
      style={{ "--glow": GLOW[state] } as React.CSSProperties}
    >
      <div className="flex flex-wrap items-center gap-x-8 gap-y-6">
        <FlameBeacon state={state} className="-my-2 -ml-3" />
        <div className="min-w-0 flex-1 space-y-3">
          <p className="eyebrow">Enshrouded dedicated server</p>
          <h1
            className={cn(
              "truncate text-[2.5rem] leading-[1.05] font-semibold tracking-[0.04em] transition-colors duration-700",
              state === "lit" ? "text-gilded" : "text-foreground",
            )}
          >
            {name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground tabular-nums">
            <span className="flex items-center gap-2 font-semibold text-foreground">
              <StatusDot tone={view.tone} pulse={changing} />
              {view.label}
            </span>
            {details.map((detail) => (
              <span
                key={(detail as React.ReactElement).key}
                className="inline-flex items-center gap-3 whitespace-nowrap"
              >
                <Sep />
                {detail}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ServerControls blockedReason={blockedReason} />
        </div>
      </div>

      {changing ? (
        <div className="relative h-px overflow-hidden bg-border">
          <div className="absolute inset-y-0 w-1/3 animate-shimmer bg-linear-to-r from-transparent via-shroud to-transparent" />
        </div>
      ) : (
        <div className="hairline" />
      )}

      {children}
    </section>
  );
};
