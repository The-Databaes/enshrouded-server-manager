import { formatDistanceToNowStrict } from "date-fns";
import { CpuIcon, FlameIcon, MemoryStickIcon, UsersIcon } from "lucide-react";

import { Badge, BadgeDot } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useNow } from "@/hooks/use-now";
import { useRuntimeStatus } from "@/hooks/use-server-runtime";
import {
  formatDuration,
  phaseView,
  uptimeMs,
} from "@/lib/server/runtime-display";
import type { PlayerSample } from "@/lib/server/runtime-types";
import { formatBytes } from "@/lib/steamcmd/task";

type StatCardProps = {
  title: string;
  value: string;
  hint?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
  muted?: boolean;
  children?: React.ReactNode;
};

const StatCard = ({
  title,
  value,
  hint,
  icon: Icon,
  accent = "text-ember",
  muted = false,
  children,
}: StatCardProps) => (
  <Card size="sm">
    <CardHeader>
      <CardDescription>{title}</CardDescription>
      <CardTitle
        className={`font-sans text-2xl font-semibold tracking-normal tabular-nums group-data-[size=sm]/card:text-2xl ${muted ? "text-muted-foreground" : ""}`}
      >
        {value}
      </CardTitle>
      <CardAction>
        <span
          className={`flex size-8 items-center justify-center rounded-md border bg-muted ${accent}`}
        >
          <Icon className="size-4" />
        </span>
      </CardAction>
    </CardHeader>
    <CardContent className="space-y-2">
      {children}
      {hint ? (
        <p className="truncate text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </CardContent>
  </Card>
);

const StatusCard = () => {
  const status = useRuntimeStatus();
  // Seconds matter while it starts; after that the minutes are enough.
  const now = useNow(status?.phase === "starting" ? 1000 : 15_000);
  const view = phaseView(status);

  let hint: string;
  if (!status) hint = "Checking…";
  else if (status.phase === "starting")
    hint = `Starting for ${formatDuration(uptimeMs(status, now))}…`;
  else if (status.phase === "stopping") hint = "Saving the world…";
  else if (status.phase === "running")
    hint = [
      `Up ${formatDuration(uptimeMs(status, now))}`,
      status.query?.version ? `v${status.query.version}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  else if (status.lastExit)
    hint =
      now - status.lastExit.at < 60_000
        ? "Stopped just now"
        : `Stopped ${formatDistanceToNowStrict(status.lastExit.at, { addSuffix: true })}`;
  else hint = "Not started yet";

  return (
    <StatCard
      title="Server status"
      value={view.label}
      icon={FlameIcon}
      muted={view.tone === "neutral"}
      hint={hint}
    >
      <Badge variant={view.tone}>
        <BadgeDot />
        {view.tone === "success" ? "Flame is lit" : view.label}
      </Badge>
    </StatCard>
  );
};

const PlayersCard = ({ history }: { history: PlayerSample[] }) => {
  const status = useRuntimeStatus();
  const query = status?.phase === "running" ? status.query : null;
  const dayAgo = Date.now() / 1000 - 86_400;
  const peak = history.reduce(
    (max, s) => (s.at >= dayAgo && s.players > max ? s.players : max),
    query?.players ?? 0,
  );
  return (
    <StatCard
      title="Players online"
      value={query ? `${query.players} / ${query.maxPlayers}` : "—"}
      icon={UsersIcon}
      accent="text-shroud"
      muted={!query}
      hint={query ? `Peak in the last 24 hours: ${peak}` : "Server offline"}
    >
      <Progress
        value={
          query ? (query.players / Math.max(1, query.maxPlayers)) * 100 : 0
        }
        tone="shroud"
        aria-label="Player slots in use"
      />
    </StatCard>
  );
};

const CpuCard = () => {
  const usage = useRuntimeStatus()?.usage ?? null;
  const cpu = usage?.cpuPercent ?? null;
  return (
    <StatCard
      title="CPU"
      value={
        cpu === null ? "—" : `${cpu < 10 ? cpu.toFixed(1) : Math.round(cpu)}%`
      }
      icon={CpuIcon}
      muted={cpu === null}
      hint={cpu === null ? "Server offline" : "Share of all CPU cores"}
    >
      <Progress value={cpu ?? 0} aria-label="CPU use" />
    </StatCard>
  );
};

const MemoryCard = () => {
  const status = useRuntimeStatus();
  const memory = status?.usage?.memoryBytes ?? null;
  const total = status?.totalMemoryBytes ?? 0;
  return (
    <StatCard
      title="Memory"
      value={memory === null ? "—" : formatBytes(memory)}
      icon={MemoryStickIcon}
      muted={memory === null}
      hint={
        memory === null
          ? "Server offline"
          : `of ${formatBytes(total)} installed`
      }
    >
      <Progress
        value={memory && total ? (memory / total) * 100 : 0}
        aria-label="Memory use"
      />
    </StatCard>
  );
};

/** The four headline numbers at the top of the dashboard. */
export const StatCards = ({ history }: { history: PlayerSample[] }) => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <StatusCard />
    <PlayersCard history={history} />
    <CpuCard />
    <MemoryCard />
  </div>
);
