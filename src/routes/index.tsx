import { createFileRoute, Link } from "@tanstack/react-router";
import { DownloadIcon, RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect } from "react";

import { PageHeader } from "@/components/app-shell/app-shell";
import { ConsoleTailCard } from "@/components/dashboard/console-tail-card";
import { DashboardAlerts } from "@/components/dashboard/dashboard-alerts";
import { OnlinePlayersCard } from "@/components/dashboard/online-players-card";
import { PlayerChartCard } from "@/components/dashboard/player-chart-card";
import { ServerDetailsCard } from "@/components/dashboard/server-details-card";
import { StatCards } from "@/components/dashboard/stat-cards";
import { ServerControls } from "@/components/server/server-controls";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlayerHistory } from "@/hooks/use-player-history";
import { useServer } from "@/hooks/use-server";
import { useServerRuntime } from "@/hooks/use-server-runtime";
import { useSteamCmd } from "@/hooks/use-steamcmd";
import type { RuntimeStatus } from "@/lib/server/runtime-types";
import type { ServerStatus } from "@/lib/server/types";
import type { SteamCmdTask } from "@/lib/steamcmd/task";

/** Why Start is unavailable, or `null` if it isn't. */
const startBlocker = (
  files: ServerStatus,
  task: SteamCmdTask | null,
  runtime: RuntimeStatus | null,
) => {
  if (files.state === "incomplete")
    return "The server install didn't finish. Resume it on the Servers page.";
  if (task?.phase === "running")
    return "SteamCMD is busy. Start the server once it has finished.";
  if (runtime?.externalPid != null)
    return "A copy of this server is already running outside the manager.";
  return null;
};

const Dashboard = () => {
  const server = useServer();
  const { task } = useSteamCmd();
  const runtime = useServerRuntime((s) => s.status);
  const history = usePlayerHistory();
  const files = server.status;

  // Starting writes the server's settings file the first time, and stopping
  // saves the world: re-read both when the phase changes.
  const phase = runtime?.phase;
  const { refresh } = server;
  useEffect(() => {
    if (phase) void refresh();
  }, [phase, refresh]);

  if (!files) {
    return server.loadError ? (
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertTitle>Couldn't read the server status</AlertTitle>
        <AlertDescription>
          <p>{server.loadError.message}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => void refresh()}
          >
            <RotateCcwIcon data-icon="inline-start" />
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    ) : (
      <>
        <PageHeader title="Dashboard" description="Loading…" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-72 w-full" />
      </>
    );
  }

  if (files.state === "notInstalled") {
    return (
      <>
        <PageHeader
          title="Dashboard"
          description="Enshrouded dedicated server"
        />
        <Empty className="shroud-mist flex-1 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <DownloadIcon />
            </EmptyMedia>
            <EmptyTitle>Install the server to get started</EmptyTitle>
            <EmptyDescription>
              SteamCMD downloads the Enshrouded dedicated server for you, or
              point the manager at one you already have.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button className="shadow-ember" asChild>
              <Link to="/servers">Set up the server</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${files.settings?.name ?? "Enshrouded server"} · Enshrouded dedicated server`}
        actions={
          <ServerControls blockedReason={startBlocker(files, task, runtime)} />
        }
      />

      <DashboardAlerts files={files} />
      <StatCards history={history} />

      <div className="grid gap-4 lg:grid-cols-5">
        <PlayerChartCard history={history} className="lg:col-span-3" />
        <ConsoleTailCard className="lg:col-span-2" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <OnlinePlayersCard className="lg:col-span-3" />
        <ServerDetailsCard files={files} className="lg:col-span-2" />
      </div>
    </>
  );
};

export const Route = createFileRoute("/")({
  component: Dashboard,
});
