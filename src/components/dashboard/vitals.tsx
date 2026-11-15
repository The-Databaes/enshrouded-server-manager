import { cn } from "cn";
import {
  ClockIcon,
  CpuIcon,
  type LucideIcon,
  MemoryStickIcon,
  UsersIcon,
} from "lucide-react";

import { Sparkline } from "@/components/sparkline";
import { useNow } from "@/hooks/use-now";
import { useRuntimeStatus, useServerRuntime } from "@/hooks/use-server-runtime";
import { formatDuration, uptimeMs } from "@/lib/server/runtime-display";
import type { PlayerSample } from "@/lib/server/runtime-types";
import { formatBytes } from "@/lib/steamcmd/task";

type VitalProps = {
  label: string;
  icon: LucideIcon;
  value: React.ReactNode;
  unit?: React.ReactNode;
  hint: React.ReactNode;
  off?: boolean;
  children?: React.ReactNode;
};

const Vital = ({
  label,
  icon: Icon,
  value,
  unit,
  hint,
  off = false,
  children,
}: VitalProps) => (
  <div className="panel flex min-w-0 flex-col gap-3 p-5">
    <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {label}
    </p>
    <p
      className={cn(
        "flex items-baseline gap-1.5 text-[2rem] leading-none font-semibold tracking-tight tabular-nums",
        off && "text-muted-foreground/60",
      )}
    >
      {value}
      {unit ? (
        <span className="text-sm font-medium tracking-normal text-muted-foreground">
          {unit}
        </span>
      ) : null}
    </p>
    <div className="h-8">{children}</div>
    <p className="truncate text-[0.8125rem] text-muted-foreground">{hint}</p>
  </div>
);

/** One pip per player slot, lit for each player online. */
const SlotPips = ({ used, total }: { used: number; total: number }) => (
  <div
    role="img"
    aria-label={`${used} of ${total} slots in use`}
    className="flex h-8 items-end gap-[3px]"
  >
    {Array.from({ length: total }, (_, i) => (
      <span
        // Slots are positions; the index is what they are.
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed positions
        key={i}
        className={cn(
          "h-3.5 flex-1 rounded-[2px] transition-colors duration-500",
          i < used
            ? "bg-shroud shadow-[0_0_6px_color-mix(in_oklch,var(--shroud)_60%,transparent)]"
            : "bg-foreground/[0.08]",
        )}
      />
    ))}
  </div>
);

const percent = (n: number) => `${n < 10 ? n.toFixed(1) : Math.round(n)}`;

const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Players, CPU, memory and uptime: the live numbers under the hero. */
export const Vitals = ({ history }: { history: PlayerSample[] }) => {
  const status = useRuntimeStatus();
  const usage = useServerRuntime((s) => s.usage);
  const running = status?.phase === "running";
  const now = useNow(30_000, running);
  const query = running ? status.query : null;
  const players = query
    ? Math.max(query.players, status?.players.length ?? 0)
    : null;
  const live = running ? status.usage : null;

  const dayAgo = Date.now() / 1000 - 86_400;
  const peak = history.reduce(
    (max, s) => (s.at >= dayAgo && s.players > max ? s.players : max),
    players ?? 0,
  );
  const cpu = usage.map((u) => u.cpuPercent);
  const memory = usage.map((u) => u.memoryBytes);

  // Offline there's nothing live to show: one line of what's worth knowing
  // instead of four empty gauges.
  if (status?.phase === "stopped" || !status) {
    const facts = [
      status?.lastExit
        ? `The last run lasted ${formatDuration(status.lastExit.ranForMs)}`
        : "The server hasn't run yet",
      peak > 0
        ? `${peak} ${peak === 1 ? "player" : "players"} at the peak today`
        : null,
    ].filter(Boolean);
    return (
      <p className="-mt-4 text-sm text-muted-foreground">
        {facts.join(" · ")}. Live players, CPU and memory show here while it
        runs.
      </p>
    );
  }

  return (
    <section
      aria-label="Vitals"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <Vital
        label="Players"
        icon={UsersIcon}
        value={players ?? "—"}
        unit={query ? `/ ${query.maxPlayers}` : undefined}
        off={players === null}
        hint={
          query
            ? peak > 0
              ? `Peak today ${peak}`
              : "Nobody yet today"
            : "Waiting for the server to answer"
        }
      >
        {query ? (
          <SlotPips used={players ?? 0} total={query.maxPlayers} />
        ) : null}
      </Vital>
      <Vital
        label="CPU"
        icon={CpuIcon}
        value={live ? percent(live.cpuPercent) : "—"}
        unit={live ? "%" : undefined}
        off={!live}
        hint={live ? "Share of all CPU cores" : "Measuring…"}
      >
        {live ? (
          <Sparkline values={cpu} max={Math.max(10, ...cpu) * 1.2} />
        ) : null}
      </Vital>
      <Vital
        label="Memory"
        icon={MemoryStickIcon}
        value={live ? formatBytes(live.memoryBytes).split(" ")[0] : "—"}
        unit={live ? formatBytes(live.memoryBytes).split(" ")[1] : undefined}
        off={!live}
        hint={
          live
            ? `of ${formatBytes(status?.totalMemoryBytes ?? 0)} installed`
            : "Measuring…"
        }
      >
        {live ? (
          <Sparkline
            values={memory}
            max={Math.max(...memory) * 1.15}
            color="var(--shroud)"
          />
        ) : null}
      </Vital>
      <Vital
        label="Uptime"
        icon={ClockIcon}
        value={running && status ? formatDuration(uptimeMs(status, now)) : "—"}
        off={!running}
        hint={
          status?.startedAt
            ? `${running ? "Since" : "Starting since"} ${clock(status.startedAt)}`
            : "Starting…"
        }
      />
    </section>
  );
};
